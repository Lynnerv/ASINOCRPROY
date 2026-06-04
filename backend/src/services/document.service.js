/**
 * Servicio de documentos.
 *
 * Flujo de carga (HU-04, modelo v3):
 *   1. Operador sube 1-2 cartas
 *   2. Se crea 1 EXPEDIENTE nuevo (estado: pendiente)
 *   3. Se crean N registros en documentos, todos con ese expediente_id
 *   4. OCR+Gemini procesa después → extrae datos y vincula cliente
 *
 * Modelo:  clientes → expedientes → documentos
 *          (1 carga = 1 expediente = 1-2 cartas de un mismo servicio)
 */

const { query } = require("../config/database");
const path = require("path");

/**
 * Registra una carga: crea 1 expediente + N documentos.
 * @param {Array} files - Archivos procesados por Multer
 * @param {number} userId - ID del usuario que sube
 * @returns {Object} { expediente_id, documentos[] }
 */
async function registerUploadedFiles(files, userId) {
  const { uploadFile } = require("../config/storage");

  const expResult = await query(
    `INSERT INTO expedientes (estado, creado_por)
     VALUES ('pendiente', $1)
     RETURNING id`,
    [userId]
  );
  const expedienteId = expResult.rows[0].id;

  const results = [];
  for (const file of files) {
    try {
      const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
      const timestamp = Date.now();
      const sanitized = file.originalname
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `documentos/${expedienteId}/${timestamp}_${sanitized}`;

      await uploadFile("documentos", storagePath, file.buffer, file.mimetype);

      const result = await query(
        `INSERT INTO documentos 
          (expediente_id, ruta_archivo, nombre_archivo, tipo_archivo, tamano_bytes, estado, subido_por)
         VALUES ($1, $2, $3, $4, $5, 'pendiente', $6)
         RETURNING id, nombre_archivo, tipo_archivo, tamano_bytes, estado, creado_en`,
        [expedienteId, storagePath, file.originalname, ext, file.size, userId]
      );

      results.push({ ...result.rows[0], resultado: "registrado" });
    } catch (err) {
      results.push({
        nombre_archivo: file.originalname,
        resultado: "error",
        error: err.message,
      });
    }
  }

  return { expediente_id: expedienteId, documentos: results };
}

/**
 * Lista documentos con paginación y filtros.
 * JOIN: documentos → expedientes → clientes
 *
 * Soporta:
 *   - estado: string o array de estados
 *   - buscar: búsqueda por NIS, cliente, número de carta
 */
async function listDocuments({ page = 1, limit = 20, estado = null, buscar = null }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  // Filtro por estado(s)
  if (estado) {
    const estados = Array.isArray(estado) ? estado : [estado];
    const placeholders = estados.map((_, i) => `$${params.length + i + 1}`);
    params.push(...estados);
    conditions.push(`d.estado IN (${placeholders.join(", ")})`);
  }

  // Búsqueda libre
  if (buscar) {
    params.push(`%${buscar}%`);
    const idx = params.length;
    conditions.push(
      `(c.nis ILIKE $${idx} OR c.nombre ILIKE $${idx} OR d.numero_carta ILIKE $${idx})`
    );
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countResult = await query(
    `SELECT COUNT(*) FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(limit, offset);
  const docsResult = await query(
    `SELECT d.id, d.expediente_id, d.nombre_archivo, d.tipo_archivo,
            d.tamano_bytes, d.numero_carta, d.fecha_carta, d.anexo,
            d.estado, d.confianza_ocr, d.creado_en,
            d.ruta_archivo,
            c.nis, c.nombre AS cliente, c.direccion, c.distrito
     FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
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
 * Obtiene un documento por ID con:
 *   - datos del cliente (via expediente)
 *   - parámetros VMA extraídos
 *   - documentos hermanos del mismo expediente
 */
async function getDocumentById(id) {
  const docResult = await query(
    `SELECT d.*,
            c.nis, c.nia, c.nombre AS cliente, c.direccion, c.distrito
     FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE d.id = $1`,
    [id]
  );

  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  const doc = docResult.rows[0];

  // Parámetros VMA
  const paramsResult = await query(
    `SELECT rp.resultado_valor, cp.codigo, cp.nombre_completo, 
            cp.unidad, cp.expresion, cp.vma_normado, cp.anexo
     FROM resultados_parametros rp
     JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
     WHERE rp.documento_id = $1`,
    [id]
  );
  doc.parametros_vma = paramsResult.rows;

  // Documentos hermanos (mismo expediente, excluye el actual)
  const siblingsResult = await query(
    `SELECT id, nombre_archivo, anexo, estado, ruta_archivo
     FROM documentos
     WHERE expediente_id = $1 AND id != $2
     ORDER BY creado_en ASC`,
    [doc.expediente_id, id]
  );
  doc.documentos_expediente = siblingsResult.rows;

  return doc;
}

module.exports = { registerUploadedFiles, listDocuments, getDocumentById };
