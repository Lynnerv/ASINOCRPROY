/**
 * Servicio de documentos.
 *
 * Gestiona la lógica de negocio para:
 * - Registrar cartas subidas en la base de datos.
 * - Crear expedientes automáticamente si no existen (RN-03).
 * - Consultar documentos y su estado.
 *
 * Flujo de carga (HU-04):
 *   1. Multer guarda archivo en disco → ruta_archivo
 *   2. Se crea registro en tabla documentos (estado: pendiente)
 *   3. El procesamiento OCR + Gemini se ejecutará después (HU siguiente)
 */

const { query } = require("../config/database");
const path = require("path");

/**
 * Registra múltiples archivos subidos en la base de datos.
 * @param {Array} files - Archivos procesados por Multer
 * @param {number} userId - ID del usuario que sube
 * @returns {Array} Documentos registrados
 */
async function registerUploadedFiles(files, userId) {
  const results = [];

  for (const file of files) {
    try {
      // Ruta relativa desde la raíz del proyecto
      const rutaRelativa = path.relative(process.cwd(), file.path).replace(/\\/g, "/");

      const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

      const result = await query(
        `INSERT INTO documentos 
          (expediente_id, ruta_archivo, nombre_archivo, tipo_archivo, tamano_bytes, estado, subido_por)
         VALUES 
          ($1, $2, $3, $4, $5, 'pendiente', $6)
         RETURNING id, nombre_archivo, tipo_archivo, tamano_bytes, estado, creado_en`,
        [
          null, // expediente_id se asigna después del procesamiento OCR
          rutaRelativa,
          file.originalname,
          ext,
          file.size,
          userId,
        ]
      );

      results.push({
        ...result.rows[0],
        resultado: "registrado",
      });
    } catch (err) {
      results.push({
        nombre_archivo: file.originalname,
        resultado: "error",
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Obtiene la lista de documentos con paginación.
 * @param {Object} options - { page, limit, estado }
 * @returns {Object} { documentos, total, page, totalPages }
 */
async function listDocuments({ page = 1, limit = 20, estado = null }) {
  const offset = (page - 1) * limit;
  let whereClause = "";
  const params = [];

  if (estado) {
    params.push(estado);
    whereClause = `WHERE d.estado = $${params.length}`;
  }

  // Total
  const countResult = await query(
    `SELECT COUNT(*) FROM documentos d ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Documentos
  params.push(limit, offset);
  const docsResult = await query(
    `SELECT d.id, d.nombre_archivo, d.tipo_archivo, d.tamano_bytes,
            d.numero_carta, d.fecha_carta, d.anexo, d.estado,
            d.confianza_ocr, d.creado_en,
            e.nis, e.cliente
     FROM documentos d
     LEFT JOIN expedientes e ON d.expediente_id = e.id
     ${whereClause}
     ORDER BY d.creado_en DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    documentos: docsResult.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Obtiene un documento por ID con sus parámetros VMA.
 * @param {number} id
 * @returns {Object} Documento con parámetros
 */
async function getDocumentById(id) {
  const docResult = await query(
    `SELECT d.*, e.nis, e.cliente, e.direccion, e.distrito
     FROM documentos d
     LEFT JOIN expedientes e ON d.expediente_id = e.id
     WHERE d.id = $1`,
    [id]
  );

  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  const doc = docResult.rows[0];

  // Obtener parámetros VMA
  const paramsResult = await query(
    `SELECT rp.resultado_valor, cp.codigo, cp.nombre_completo, 
            cp.unidad, cp.expresion, cp.vma_normado, cp.anexo
     FROM resultados_parametros rp
     JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
     WHERE rp.documento_id = $1`,
    [id]
  );

  doc.parametros_vma = paramsResult.rows;

  return doc;
}

module.exports = { registerUploadedFiles, listDocuments, getDocumentById };
