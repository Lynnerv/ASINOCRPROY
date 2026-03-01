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
  // 1. Crear expediente
  const expResult = await query(
    `INSERT INTO expedientes (estado, creado_por)
     VALUES ('pendiente', $1)
     RETURNING id`,
    [userId]
  );
  const expedienteId = expResult.rows[0].id;

  // 2. Registrar cada documento vinculado al expediente
  const results = [];
  for (const file of files) {
    try {
      const rutaRelativa = path
        .relative(process.cwd(), file.path)
        .replace(/\\/g, "/");

      const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

      const result = await query(
        `INSERT INTO documentos 
          (expediente_id, ruta_archivo, nombre_archivo, tipo_archivo, tamano_bytes, estado, subido_por)
         VALUES ($1, $2, $3, $4, $5, 'pendiente', $6)
         RETURNING id, nombre_archivo, tipo_archivo, tamano_bytes, estado, creado_en`,
        [expedienteId, rutaRelativa, file.originalname, ext, file.size, userId]
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
 * Lista documentos con paginación + filtros HU-08
 * Filtros: estado, buscar, nis, cliente, tipo (tipo_notificacion), rango de fechas (fecha_carta)
 * Orden: fecha desc por defecto
 *
 * IMPORTANTE:
 * - UI quiere: pendiente / en_revision / procesado / archivado
 * - BD hoy tiene: pendiente / procesando / procesado / validado / error
 * => mapeamos estado UI -> estado BD sin cambiar tu flujo existente.
 */
async function listDocuments({
  page = 1,
  limit = 10,
  estado = null,
  buscar = null,
  nis = null,
  cliente = null,
  tipo = null,
  fecha_inicio = null,  // soporta snake_case desde frontend
  fecha_fin = null,     // soporta snake_case desde frontend
  fechaInicio = null,   // soporta camelCase por compatibilidad
  fechaFin = null,      // soporta camelCase por compatibilidad
}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  // normalizar fechas (acepta ambos nombres)
  const fIni = fechaInicio || fecha_inicio || null;
  const fFin = fechaFin || fecha_fin || null;

  // estado (map UI -> BD)
  if (estado) {
    const estadoMap = {
      en_revision: ["procesando"],
      archivado: ["validado"],
      pendiente: ["pendiente"],
      procesado: ["procesado"],
    };

    const estadosDB = estadoMap[estado] || [estado];

    if (estadosDB.length === 1) {
      params.push(estadosDB[0]);
      conditions.push(`d.estado = $${params.length}`);
    } else {
      const placeholders = estadosDB
        .map((_, i) => `$${params.length + i + 1}`)
        .join(", ");
      params.push(...estadosDB);
      conditions.push(`d.estado IN (${placeholders})`);
    }
  }

  // nis
  if (nis) {
    params.push(`%${nis}%`);
    conditions.push(`c.nis ILIKE $${params.length}`);
  }

  // cliente
  if (cliente) {
    params.push(`%${cliente}%`);
    conditions.push(`c.nombre ILIKE $${params.length}`);
  }

  // tipo (tipo_notificacion)
  if (tipo) {
    params.push(`%${tipo}%`);
    conditions.push(`d.tipo_notificacion ILIKE $${params.length}`);
  }

  // buscar (texto libre)
  if (buscar) {
    params.push(`%${buscar}%`);
    const idx = params.length;
    conditions.push(`(
      c.nis ILIKE $${idx}
      OR c.nombre ILIKE $${idx}
      OR d.numero_carta ILIKE $${idx}
      OR d.nombre_archivo ILIKE $${idx}
      OR d.tipo_notificacion ILIKE $${idx}
    )`);
  }

  // rango fechas (fecha_carta)
  if (fIni) {
    params.push(fIni);
    conditions.push(`d.fecha_carta >= $${params.length}`);
  }
  if (fFin) {
    params.push(fFin);
    conditions.push(`d.fecha_carta <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // count
  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
     ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  // data
  params.push(limit, offset);
  const docsResult = await query(
    `SELECT
        d.id,
        d.nombre_archivo,
        d.numero_carta,
        d.tipo_notificacion,
        d.fecha_carta,
        d.estado,
        c.nis,
        c.nombre AS cliente
     FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
     ${whereClause}
     ORDER BY d.fecha_carta DESC NULLS LAST, d.creado_en DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params
  );

  return {
    documentos: docsResult.rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Obtiene un documento por ID con cliente y parámetros VMA.
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