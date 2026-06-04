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
const fs = require("fs");
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
 *
 * Matching robusto contra catalogo_parametros:
 *   1. Código entre paréntesis: "Demanda... (DBO5)" → busca codigo='DBO5'
 *   2. Código/expresión directo del campo parametro
 *   3. Match por nombre normalizado (sin acentos, JS-side) con ILIKE
 *   4. Match por palabras clave del nombre
 *
 * Cada parámetro se procesa independientemente (try-catch individual).
 */
async function insertParametros(documentoId, parametros) {
  if (!parametros || parametros.length === 0) return;

  let inserted = 0;
  let failed = 0;

  for (const p of parametros) {
    try {
      const nombreRaw = p.parametro || p.expresion || "";
      const valorRaw = p.resultado_valor;

      // Saltar si no hay valor
      if (valorRaw == null || String(valorRaw).trim() === "") {
        console.warn(`[Params] Sin valor para: "${nombreRaw}" — saltando`);
        continue;
      }

      // 1. Extraer código entre paréntesis: "Demanda Bioquímica de Oxígeno (DBO5)" → "DBO5"
      const codeMatch = nombreRaw.match(/\(([^)]+)\)\s*$/);
      const codeFromParens = codeMatch ? codeMatch[1].trim().toUpperCase() : null;

      // 2. Limpiar nombre (sin paréntesis ni acentos)
      const nombreSinParens = nombreRaw.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const nombreNorm = normalizeStr(nombreSinParens);

      let catalogoId = null;

      // Intento 1: match por código extraído de paréntesis
      if (codeFromParens) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE UPPER(codigo) = $1 OR UPPER(expresion) = $1
           LIMIT 1`,
          [codeFromParens]
        );
      }

      // Intento 2: match por nombre directo como código/expresión
      if (!catalogoId) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE UPPER(codigo) = UPPER($1) OR UPPER(expresion) = UPPER($1)
           LIMIT 1`,
          [nombreRaw.trim()]
        );
      }

      // Intento 3: match por nombre normalizado con ILIKE (sin unaccent SQL)
      if (!catalogoId && nombreNorm.length > 3) {
        catalogoId = await findParam(
          `SELECT id FROM catalogo_parametros 
           WHERE LOWER(nombre_completo) ILIKE $1
           LIMIT 1`,
          [`%${nombreNorm}%`]
        );
      }

      // Intento 4: match por palabras clave del nombre
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
        console.warn(
          `[Params] No match en catálogo para: "${nombreRaw}" (código: ${codeFromParens || "N/A"})`
        );
        failed++;
      }
    } catch (err) {
      console.error(`[Params] Error insertando parámetro "${p.parametro}":`, err.message);
      failed++;
      // Continua con el siguiente parámetro — NO detiene el loop
    }
  }

  console.log(`[Params] doc=${documentoId}: ${inserted} insertados, ${failed} fallidos de ${parametros.length}`);
}

/**
 * Helper: busca un parámetro en catálogo, devuelve id o null.
 */
async function findParam(sql, params) {
  try {
    const result = await query(sql, params);
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch {
    return null; // SQL falló (ej: extensión no disponible) → no romper
  }
}

/**
 * Normaliza string: minúsculas, sin acentos, sin caracteres especiales.
 */
function normalizeStr(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // quitar acentos
    .replace(/[^a-z0-9\s]/g, "")      // solo alfanumérico
    .trim();
}

/**
 * Extrae palabras clave significativas de un nombre de parámetro.
 * Ej: "Demanda Bioquímica de Oxígeno" → ["bioquimica", "oxigeno", "demanda"]
 */
function extractKeywords(name) {
  const stopwords = ["de", "del", "la", "el", "los", "las", "y", "en", "total", "mg", "l"];
  return normalizeStr(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.includes(w))
    .sort((a, b) => b.length - a.length); // más largas primero = más específicas
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
  const { downloadFile } = require("../config/storage");
  const os = require("os");

  let imagePath;
  let tempFile = false;

  if (doc.ruta_archivo.startsWith("documentos/")) {
    const buffer = await downloadFile("documentos", doc.ruta_archivo);
    imagePath = path.join(os.tmpdir(), `ocr_${doc.id}_${Date.now()}.jpg`);
    fs.writeFileSync(imagePath, buffer);
    tempFile = true;
  } else {
    imagePath = path.resolve(process.cwd(), doc.ruta_archivo);
  }

  try {
    await query("UPDATE documentos SET estado = 'procesando' WHERE id = $1", [
      doc.id,
    ]);

    // 1. Pipeline
    const data = await runPipeline(imagePath);

    // Validar que sea una carta de notificacion VMA
    const tieneNumeroCarta = data.numero_carta && String(data.numero_carta).trim().length > 0;
    const tieneAnexo = data.anexo && String(data.anexo).trim().length > 0;
    const tieneParametros = Array.isArray(data.parametros_vma) && data.parametros_vma.length > 0;
    const tieneNIS = data.nis && String(data.nis).trim().length > 0;

    if (!tieneNumeroCarta && !tieneAnexo && !tieneParametros && !tieneNIS) {
      throw new Error("DOCUMENTO_NO_RECONOCIDO");
    }

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
         estado = 'validado',
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
  } finally {
    if (tempFile && fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch {}
    }
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
       COUNT(*) FILTER (WHERE estado IN ('procesado','validado'))::int AS listos,
       COUNT(*) FILTER (WHERE estado = 'error')::int AS errores
     FROM documentos 
     WHERE expediente_id = $1`,
    [expedienteId]
  );

  const { total, listos } = result.rows[0];

  if (listos === total && total > 0) {
    await query(
      `UPDATE expedientes SET estado = 'completo', actualizado_en = NOW() WHERE id = $1`,
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
