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
const { crearNotificacion } = require("./notifications.service"); // ✅ HU10

const PYTHON_CMD = process.env.PYTHON_CMD || "python";
const OCR_SERVICE_DIR = path.resolve(
  process.env.OCR_SERVICE_DIR || path.join(process.cwd(), "..", "ocr_service")
);

// ── Fecha parsing ──────────────────────────────────────────────────────

const MESES = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

/**
 * Convierte fecha en español/formato latino a ISO (YYYY-MM-DD).
 *   "14 de agosto de 2025" → "2025-08-14"
 *   "04/09/2025"           → "2025-09-04"
 *   "2025-08-14"           → "2025-08-14"
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const esMatch = s
    .toLowerCase()
    .match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
  if (esMatch) {
    const [, d, mesNombre, y] = esMatch;
    const m = MESES[mesNombre];
    if (m) return `${y}-${m}-${String(d).padStart(2, "0")}`;
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
          return reject(new Error(`Pipeline fallo: ${error.message}\n${stderr}`));
        }

        try {
          const jsonMatch = stdout.match(/\[[\s\S]*\]/);
          if (!jsonMatch) return reject(new Error("Pipeline no devolvio JSON valido"));

          const arr = JSON.parse(jsonMatch[0]);
          if (!arr || arr.length === 0) return reject(new Error("Pipeline devolvio un array vacio"));

          resolve(arr[0]);
        } catch (parseErr) {
          reject(new Error(`Error parseando respuesta: ${parseErr.message}`));
        }
      }
    );
  });
}

// ── Cliente (datos fijos por NIS) ──────────────────────────────────────

async function findOrCreateCliente({ nis, nia, nombre, direccion, distrito }) {
  if (!nis) return null;

  const existing = await query("SELECT id FROM clientes WHERE nis = $1", [nis]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const result = await query(
    `INSERT INTO clientes (nis, nia, nombre, direccion, distrito)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [nis, nia || null, nombre || "Sin nombre", direccion || null, distrito || null]
  );

  return result.rows[0].id;
}

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

async function insertParametros(documentoId, parametros) {
  if (!parametros || parametros.length === 0) return;

  let inserted = 0;
  let failed = 0;

  for (const p of parametros) {
    try {
      const nombreRaw = p.parametro || p.expresion || "";
      const valorRaw = p.resultado_valor;

      if (valorRaw == null || String(valorRaw).trim() === "") continue;

      const codeMatch = nombreRaw.match(/\(([^)]+)\)\s*$/);
      const codeFromParens = codeMatch ? codeMatch[1].trim().toUpperCase() : null;

      const nombreSinParens = nombreRaw.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const nombreNorm = normalizeStr(nombreSinParens);

      let catalogoId = null;

      if (codeFromParens) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE UPPER(codigo) = $1 OR UPPER(expresion) = $1
           LIMIT 1`,
          [codeFromParens]
        );
      }

      if (!catalogoId) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE UPPER(codigo) = UPPER($1) OR UPPER(expresion) = UPPER($1)
           LIMIT 1`,
          [nombreRaw.trim()]
        );
      }

      if (!catalogoId && nombreNorm.length > 3) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE LOWER(nombre_completo) ILIKE $1
           LIMIT 1`,
          [`%${nombreNorm}%`]
        );
      }

      if (!catalogoId) {
        const keywords = extractKeywords(nombreSinParens);
        for (const kw of keywords) {
          catalogoId = await findParam(
            `SELECT id FROM catalogo_parametros 
             WHERE LOWER(nombre_completo) ILIKE $1
             LIMIT 1`,
            [`%${kw}%`]
          );
          if (catalogoId) break;
        }
      }

      if (catalogoId) {
        await query(
          `INSERT INTO resultados_parametros (documento_id, parametro_id, resultado_valor)
           VALUES ($1, $2, $3)
           ON CONFLICT (documento_id, parametro_id) DO UPDATE SET resultado_valor = $3`,
          [documentoId, catalogoId, String(valorRaw)]
        );
        inserted++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[Params] Error insertando parámetro "${p.parametro}":`, err.message);
      failed++;
    }
  }

  console.log(
    `[Params] doc=${documentoId}: ${inserted} insertados, ${failed} fallidos de ${parametros.length}`
  );
}

async function findParam(sql, params) {
  try {
    const result = await query(sql, params);
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch {
    return null;
  }
}

function normalizeStr(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function extractKeywords(name) {
  const stopwords = ["de", "del", "la", "el", "los", "las", "y", "en", "total", "mg", "l"];
  return normalizeStr(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.includes(w))
    .sort((a, b) => b.length - a.length);
}

// ── HU10 helper ────────────────────────────────────────────────────────

async function notifySafe(payload) {
  try {
    if (!payload?.usuario_id) return; // sin usuario -> no notificar
    await crearNotificacion(payload);
  } catch (e) {
    console.warn("[HU10] No se pudo crear notificación:", e.message);
  }
}

// ── Procesamiento ──────────────────────────────────────────────────────

/**
 * Obtiene documentos pendientes de procesamiento.
 * ✅ Usa subido_por (porque tu tabla tiene subido_por)
 */
async function getPendingDocuments(estados = ["pendiente"]) {
  const placeholders = estados.map((_, i) => `$${i + 1}`).join(", ");
  const result = await query(
    `SELECT d.id, d.expediente_id, d.ruta_archivo, d.nombre_archivo, d.subido_por
     FROM documentos d
     WHERE d.estado IN (${placeholders})
     ORDER BY d.creado_en ASC`,
    estados
  );
  return result.rows;
}

/**
 * Procesa un documento individual.
 */
async function processDocument(doc) {
  const imagePath = path.resolve(process.cwd(), doc.ruta_archivo);

  try {
    await query("UPDATE documentos SET estado = 'procesando' WHERE id = $1", [doc.id]);

    // 1. Pipeline
    const data = await runPipeline(imagePath);

    // 2. Cliente por NIS
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

    // ✅ HU10: notificación OCR OK al usuario que subió (subido_por)
    await notifySafe({
      usuario_id: doc.subido_por,
      tipo: "OCR",
      titulo: "OCR procesado exitosamente",
      mensaje: `El documento "${doc.nombre_archivo}" fue procesado correctamente.`,
      referencia_tipo: "documento",
      referencia_id: doc.id,
    });

    // 6. Actualizar estado del expediente si todos procesados
    const expedienteProcesado = await updateExpedienteStatus(doc.expediente_id);

    // ✅ HU10: notificar cuando expediente se procesó completo
    if (expedienteProcesado) {
      // tomamos el usuario del primer documento del expediente
      const u = await query(
        `SELECT MIN(subido_por)::bigint AS usuario_id
         FROM documentos
         WHERE expediente_id = $1`,
        [doc.expediente_id]
      );
      const userId = u.rows[0]?.usuario_id;

      await notifySafe({
        usuario_id: userId,
        tipo: "EXPEDIENTE",
        titulo: "Expediente procesado",
        mensaje: `El expediente ${doc.expediente_id} se procesó completamente.`,
        referencia_tipo: "expediente",
        referencia_id: doc.expediente_id,
      });
    }

    return { id: doc.id, nombre_archivo: doc.nombre_archivo, estado: "procesado" };
  } catch (err) {
    await query(
      `UPDATE documentos 
       SET estado = 'error', extraido_json = $2, actualizado_en = NOW()
       WHERE id = $1`,
      [doc.id, JSON.stringify({ error: err.message })]
    );

    // ✅ HU10: notificación OCR ERROR al usuario que subió (subido_por)
    await notifySafe({
      usuario_id: doc.subido_por,
      tipo: "ERROR",
      titulo: "Error en procesamiento OCR",
      mensaje: `No se pudo procesar "${doc.nombre_archivo}". Motivo: ${err.message}`,
      referencia_tipo: "documento",
      referencia_id: doc.id,
    });

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
 * Retorna true si quedó procesado.
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
      `UPDATE expedientes 
       SET estado = 'procesado', actualizado_en = NOW()
       WHERE id = $1`,
      [expedienteId]
    );
    return true;
  }

  return false;
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