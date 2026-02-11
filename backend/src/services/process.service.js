/**
 * Servicio de procesamiento OCR + Gemini (modelo v3).
 *
 * Flujo por documento:
 *   1. Ejecuta pipeline Python (EasyOCR + Gemini)
 *   2. Parsea el JSON extraido
 *   3. Con el NIS: encuentra o crea el CLIENTE
 *   4. Vincula el EXPEDIENTE (ya existente) al cliente
 *   5. Actualiza campos extraidos en el documento
 *   6. Inserta parametros VMA normalizados
 *
 * Modelo: clientes (NIS unico) → expedientes (1 por carga) → documentos
 */

const { execFile } = require("child_process");
const path = require("path");
const { query } = require("../config/database");

const PYTHON_CMD = process.env.PYTHON_CMD || "python";
const OCR_SERVICE_DIR = path.resolve(
  process.env.OCR_SERVICE_DIR || path.join(process.cwd(), "..", "ocr_service")
);

// ── Fecha parsing ──────────────────────────────────────────────────────

const MESES = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

/**
 * Convierte fecha en español/formato latino a ISO (YYYY-MM-DD).
 *   "14 de agosto de 2025" → "2025-08-14"
 *   "04/09/2025"           → "2025-09-04"
 *   "2025-08-14"           → "2025-08-14"
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const esMatch = s.toLowerCase().match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (esMatch) {
    const [, d, mesNombre, y] = esMatch;
    const m = MESES[mesNombre];
    if (m) return `${y}-${m}-${d.padStart(2, "0")}`;
  }

  console.warn(`Fecha no reconocida, guardando como null: "${raw}"`);
  return null;
}

// ── Pipeline Python ────────────────────────────────────────────────────

/**
 * Ejecuta el pipeline Python sobre una imagen.
 * CLI: python pipeline.py <ruta_imagen>
 * Salida: JSON array a stdout
 */
function runPipeline(imagePath) {
  return new Promise((resolve, reject) => {
    const args = ["pipeline.py", imagePath];

    execFile(
      PYTHON_CMD,
      args,
      {
        cwd: OCR_SERVICE_DIR,
        timeout: 120000,
        maxBuffer: 1024 * 1024 * 10,
        encoding: "utf8",
        env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(
            new Error(`Pipeline fallo: ${error.message}\n${stderr}`)
          );
        }

        try {
          const jsonMatch = stdout.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            return reject(new Error("Pipeline no devolvio JSON valido"));
          }
          const arr = JSON.parse(jsonMatch[0]);
          if (!arr || arr.length === 0) {
            return reject(new Error("Pipeline devolvio un array vacio"));
          }
          resolve(arr[0]);
        } catch (parseErr) {
          reject(new Error(`Error parseando respuesta: ${parseErr.message}`));
        }
      }
    );
  });
}

// ── Cliente (datos fijos por NIS) ──────────────────────────────────────

/**
 * Busca o crea un cliente por NIS.
 * Si el NIS ya existe, retorna el ID existente.
 * Si no, crea uno nuevo con los datos extraidos.
 */
async function findOrCreateCliente({ nis, nia, nombre, direccion, distrito }) {
  if (!nis) return null;

  const existing = await query(
    "SELECT id FROM clientes WHERE nis = $1",
    [nis]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const result = await query(
    `INSERT INTO clientes (nis, nia, nombre, direccion, distrito)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nis, nia || null, nombre || "Sin nombre", direccion || null, distrito || null]
  );

  return result.rows[0].id;
}

/**
 * Vincula un expediente a un cliente (si aun no esta vinculado).
 */
async function linkExpedienteToCliente(expedienteId, clienteId) {
  if (!clienteId) return;

  await query(
    `UPDATE expedientes 
     SET cliente_id = $2, actualizado_en = NOW() 
     WHERE id = $1 AND cliente_id IS NULL`,
    [expedienteId, clienteId]
  );
}

// ── Parametros VMA ─────────────────────────────────────────────────────

/**
 * Inserta los parametros VMA extraidos en resultados_parametros.
 */
async function insertParametros(documentoId, parametros) {
  if (!parametros || parametros.length === 0) return;

  for (const p of parametros) {
    const catalogo = await query(
      `SELECT id FROM catalogo_parametros 
       WHERE codigo = $1 OR nombre_completo ILIKE $2 OR expresion = $1
       LIMIT 1`,
      [p.parametro || p.expresion, `%${p.parametro}%`]
    );

    if (catalogo.rows.length > 0) {
      await query(
        `INSERT INTO resultados_parametros (documento_id, parametro_id, resultado_valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (documento_id, parametro_id) DO UPDATE SET resultado_valor = $3`,
        [documentoId, catalogo.rows[0].id, p.resultado_valor || null]
      );
    }
  }
}

// ── Procesamiento ──────────────────────────────────────────────────────

/**
 * Obtiene documentos pendientes de procesamiento.
 */
async function getPendingDocuments(estados = ["pendiente"]) {
  const placeholders = estados.map((_, i) => `$${i + 1}`).join(", ");
  const result = await query(
    `SELECT d.id, d.expediente_id, d.ruta_archivo, d.nombre_archivo 
     FROM documentos d
     WHERE d.estado IN (${placeholders})
     ORDER BY d.creado_en ASC`,
    estados
  );
  return result.rows;
}

/**
 * Procesa un documento individual.
 *
 *   1. Ejecuta pipeline OCR+Gemini
 *   2. Encuentra/crea cliente por NIS
 *   3. Vincula expediente al cliente
 *   4. Actualiza documento con campos extraidos
 *   5. Inserta parametros VMA
 */
async function processDocument(doc) {
  const imagePath = path.resolve(process.cwd(), doc.ruta_archivo);

  try {
    await query("UPDATE documentos SET estado = 'procesando' WHERE id = $1", [
      doc.id,
    ]);

    // 1. Pipeline
    const data = await runPipeline(imagePath);

    // 2. Encontrar/crear cliente por NIS
    const clienteId = await findOrCreateCliente({
      nis: data.nis,
      nia: data.nia,
      nombre: data.cliente,
      direccion: data.direccion_cliente,
      distrito: data.distrito,
    });

    // 3. Vincular expediente al cliente
    await linkExpedienteToCliente(doc.expediente_id, clienteId);

    // 4. Actualizar documento
    await query(
      `UPDATE documentos SET
         numero_carta = $2,
         fecha_carta = $3,
         tipo_notificacion = $4,
         anexo = $5,
         numero_acta = $6,
         fecha_muestra = $7,
         numero_informe = $8,
         extraido_json = $9,
         estado = 'procesado',
         actualizado_en = NOW()
       WHERE id = $1`,
      [
        doc.id,
        data.numero_carta || null,
        parseDate(data.fecha),
        data.tipo_notificacion || null,
        data.anexo || null,
        data.numero_acta || null,
        parseDate(data.fecha_muestra),
        data.numero_informe || null,
        JSON.stringify(data),
      ]
    );

    // 5. Parametros VMA
    await insertParametros(doc.id, data.parametros_vma);

    // 6. Actualizar estado del expediente si todos procesados
    await updateExpedienteStatus(doc.expediente_id);

    return { id: doc.id, nombre_archivo: doc.nombre_archivo, estado: "procesado" };
  } catch (err) {
    await query(
      `UPDATE documentos SET estado = 'error', extraido_json = $2, actualizado_en = NOW() WHERE id = $1`,
      [doc.id, JSON.stringify({ error: err.message })]
    );

    return {
      id: doc.id,
      nombre_archivo: doc.nombre_archivo,
      estado: "error",
      error: err.message,
    };
  }
}

/**
 * Actualiza el estado del expediente basado en sus documentos.
 *   - Todos procesados → 'procesado'
 *   - Alguno con error → mantiene 'pendiente'
 */
async function updateExpedienteStatus(expedienteId) {
  const result = await query(
    `SELECT 
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE estado = 'procesado')::int AS procesados,
       COUNT(*) FILTER (WHERE estado = 'error')::int AS errores
     FROM documentos 
     WHERE expediente_id = $1`,
    [expedienteId]
  );

  const { total, procesados } = result.rows[0];

  if (procesados === total && total > 0) {
    await query(
      `UPDATE expedientes SET estado = 'procesado', actualizado_en = NOW() WHERE id = $1`,
      [expedienteId]
    );
  }
}

/**
 * Resumen de conteos por estado de documentos.
 */
async function getStatusSummary() {
  const result = await query(
    `SELECT estado, COUNT(*)::int as cantidad FROM documentos GROUP BY estado`
  );
  const summary = { pendiente: 0, procesando: 0, procesado: 0, error: 0 };
  result.rows.forEach((r) => {
    summary[r.estado] = r.cantidad;
  });
  summary.total = Object.values(summary).reduce((a, b) => a + b, 0);
  return summary;
}

module.exports = {
  getPendingDocuments,
  processDocument,
  getStatusSummary,
};