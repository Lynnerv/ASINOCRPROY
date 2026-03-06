/**
 * Servicio de expedientes.
 *
 * Gestiona expedientes y sus documentos para el panel de control.
 * Modelo: clientes → expedientes → documentos
 *
 * Un expediente se crea al subir cartas (1 carga = 1 expediente).
 * Puede tener 1-2 documentos (Anexo 1 y/o Anexo 2).
 */

const { query } = require("../config/database");
const fs = require("fs");
const path = require("path");

/**
 * Lista expedientes pendientes con sus documentos.
 * Incluye URLs de imagen para vista previa.
 */
async function listPendingExpedientes() {
  // Expedientes que tienen al menos 1 documento pendiente o con error
  const expResult = await query(
    `SELECT e.id, e.estado, e.creado_en,
            c.nis, c.nombre AS cliente, c.direccion, c.distrito
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.id IN (
       SELECT DISTINCT expediente_id FROM documentos
       WHERE estado IN ('pendiente', 'error')
     )
     ORDER BY e.creado_en DESC`
  );

  // Para cada expediente, obtener sus documentos
  const expedientes = [];
  for (const exp of expResult.rows) {
    const docsResult = await query(
      `SELECT id, nombre_archivo, tipo_archivo, tamano_bytes,
              ruta_archivo, estado, anexo, numero_carta,
              extraido_json, creado_en
       FROM documentos
       WHERE expediente_id = $1
       ORDER BY creado_en ASC`,
      [exp.id]
    );

    expedientes.push({
      ...exp,
      documentos: docsResult.rows.map((d) => ({
        ...d,
        imagen_url: `/${d.ruta_archivo.replace(/\\/g, "/")}`,
      })),
    });
  }

  return expedientes;
}

/**
 * Lista TODOS los expedientes (para selector de destino al mover).
 */
async function listAllExpedientes() {
  const result = await query(
    `SELECT e.id, e.estado, e.creado_en,
            c.nis, c.nombre AS cliente,
            COUNT(d.id)::int AS num_documentos
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     LEFT JOIN documentos d ON d.expediente_id = e.id
     GROUP BY e.id, e.estado, e.creado_en, c.nis, c.nombre
     ORDER BY e.creado_en DESC`
  );
  return result.rows;
}

/**
 * Crea un expediente vacío (para mover documentos a uno nuevo).
 */
async function createEmptyExpediente(userId) {
  const result = await query(
    `INSERT INTO expedientes (estado, creado_por)
     VALUES ('pendiente', $1)
     RETURNING id, estado, creado_en`,
    [userId]
  );
  return result.rows[0];
}

/**
 * Elimina un documento y su archivo físico.
 * Si el expediente queda vacío, lo elimina también.
 */
async function deleteDocument(documentId) {
  // Obtener info del documento
  const docResult = await query(
    "SELECT id, expediente_id, ruta_archivo FROM documentos WHERE id = $1",
    [documentId]
  );

  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  const doc = docResult.rows[0];

  // Eliminar resultados_parametros asociados
  await query("DELETE FROM resultados_parametros WHERE documento_id = $1", [
    documentId,
  ]);

  // Eliminar documento de BD
  await query("DELETE FROM documentos WHERE id = $1", [documentId]);

  // Eliminar archivo físico
  const filePath = path.resolve(process.cwd(), doc.ruta_archivo);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Si el expediente quedó vacío, eliminarlo
  const remaining = await query(
    "SELECT COUNT(*)::int AS count FROM documentos WHERE expediente_id = $1",
    [doc.expediente_id]
  );

  if (remaining.rows[0].count === 0) {
    await query("DELETE FROM expedientes WHERE id = $1", [doc.expediente_id]);
    return { deleted: true, expediente_deleted: true };
  }

  return { deleted: true, expediente_deleted: false };
}

/**
 * Mueve un documento a otro expediente.
 * Si el expediente origen queda vacío, lo elimina.
 */
async function moveDocument(documentId, targetExpedienteId) {
  // Verificar documento
  const docResult = await query(
    "SELECT id, expediente_id FROM documentos WHERE id = $1",
    [documentId]
  );
  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  const sourceExpedienteId = docResult.rows[0].expediente_id;

  if (sourceExpedienteId === targetExpedienteId) {
    return { moved: false, message: "El documento ya está en ese expediente" };
  }

  // Verificar expediente destino
  const expResult = await query(
    "SELECT id FROM expedientes WHERE id = $1",
    [targetExpedienteId]
  );
  if (expResult.rows.length === 0) {
    throw Object.assign(new Error("Expediente destino no encontrado"), {
      status: 404,
    });
  }

  // Mover
  await query(
    `UPDATE documentos SET expediente_id = $2, actualizado_en = NOW() WHERE id = $1`,
    [documentId, targetExpedienteId]
  );

  // Si el origen quedó vacío, eliminarlo
  const remaining = await query(
    "SELECT COUNT(*)::int AS count FROM documentos WHERE expediente_id = $1",
    [sourceExpedienteId]
  );

  if (remaining.rows[0].count === 0) {
    await query("DELETE FROM expedientes WHERE id = $1", [sourceExpedienteId]);
  }

  return { moved: true, from: sourceExpedienteId, to: targetExpedienteId };
}

module.exports = {
  listPendingExpedientes,
  listAllExpedientes,
  listProcessedExpedientes,
  getExpedienteDetail,
  createEmptyExpediente,
  deleteDocument,
  moveDocument,
  // HU-07: Validación
  updateDocumentFields,
  validateDocument,
  markDocumentPending,
};

/**
 * Lista expedientes procesados con paginación y filtros (HU-06).
 *
 * Agrupación: 1 fila por expediente, con conteo de documentos.
 * Filtros: estado del expediente, búsqueda por NIS/cliente.
 * Orden: fecha más reciente descendente.
 */
async function listProcessedExpedientes({ page = 1, limit = 15, estado = null, buscar = null }) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  // Solo expedientes que tienen al menos 1 documento procesado o validado
  conditions.push(
    `e.id IN (SELECT DISTINCT expediente_id FROM documentos WHERE estado IN ('procesado','validado'))`
  );

  if (estado) {
    params.push(estado);
    conditions.push(`e.estado = $${params.length}`);
  }

  if (buscar) {
    params.push(`%${buscar}%`);
    const idx = params.length;
    conditions.push(`(c.nis ILIKE $${idx} OR c.nombre ILIKE $${idx})`);
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  // Count
  const countResult = await query(
    `SELECT COUNT(DISTINCT e.id)::int AS total
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  // Expedientes with aggregated info
  params.push(limit, offset);
  const expResult = await query(
    `SELECT e.id, e.estado, e.creado_en,
            c.nis, c.nombre AS cliente, c.direccion, c.distrito,
            COUNT(d.id)::int AS num_documentos,
            MAX(d.fecha_carta) AS fecha_mas_reciente,
            COUNT(d.id) FILTER (WHERE d.estado = 'validado')::int AS validados,
            COUNT(d.id) FILTER (WHERE d.estado = 'procesado')::int AS procesados,
            COUNT(d.id) FILTER (WHERE d.estado = 'error')::int AS errores,
            ARRAY_AGG(DISTINCT d.anexo) FILTER (WHERE d.anexo IS NOT NULL) AS anexos
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     LEFT JOIN documentos d ON d.expediente_id = e.id
     ${whereClause}
     GROUP BY e.id, e.estado, e.creado_en, c.nis, c.nombre, c.direccion, c.distrito
     ORDER BY MAX(d.fecha_carta) DESC NULLS LAST, e.creado_en DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    expedientes: expResult.rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Obtiene el detalle completo de un expediente (HU-06).
 *
 * Incluye:
 *   - Datos del cliente
 *   - Todos los documentos con sus parámetros VMA
 */
async function getExpedienteDetail(expedienteId) {
  // Expediente + cliente
  const expResult = await query(
    `SELECT e.id, e.estado, e.observaciones, e.creado_en, e.actualizado_en,
            c.id AS cliente_id, c.nis, c.nia, c.nombre AS cliente,
            c.direccion, c.distrito
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.id = $1`,
    [expedienteId]
  );

  if (expResult.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  const expediente = expResult.rows[0];

  // Documentos
  const docsResult = await query(
    `SELECT id, nombre_archivo, tipo_archivo, tamano_bytes, ruta_archivo,
            numero_carta, fecha_carta, tipo_notificacion, anexo,
            numero_acta, fecha_muestra, numero_informe,
            estado, confianza_ocr, creado_en
     FROM documentos
     WHERE expediente_id = $1
     ORDER BY anexo ASC NULLS LAST, creado_en ASC`,
    [expedienteId]
  );

  // Para cada documento, obtener sus parámetros VMA
  const documentos = [];
  for (const doc of docsResult.rows) {
    const paramsResult = await query(
      `SELECT rp.id AS resultado_id, rp.resultado_valor,
              cp.codigo, cp.nombre_completo, cp.unidad,
              cp.expresion, cp.vma_normado, cp.anexo
       FROM resultados_parametros rp
       JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
       WHERE rp.documento_id = $1
       ORDER BY cp.id ASC`,
      [doc.id]
    );

    documentos.push({
      ...doc,
      imagen_url: `/${doc.ruta_archivo.replace(/\\/g, "/")}`,
      parametros_vma: paramsResult.rows,
    });
  }

  expediente.documentos = documentos;
  return expediente;
}

// ══════════════════════════════════════════
//  HU-07: Validación de datos extraídos
// ══════════════════════════════════════════

/**
 * Actualiza campos de un documento y sus parámetros VMA.
 * NO cambia el estado del documento (se mantiene como está).
 *
 * @param {number} docId - ID del documento
 * @param {object} fields - Campos de la carta: numero_carta, fecha_carta, etc.
 * @param {Array} parametros - Array de { resultado_id, resultado_valor }
 * @param {number} userId - ID del usuario que edita
 */
async function updateDocumentFields(docId, fields, parametros, userId) {
  // Verificar que el documento existe y no está validado
  const docResult = await query(
    "SELECT id, estado, expediente_id FROM documentos WHERE id = $1",
    [docId]
  );
  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }
  if (docResult.rows[0].estado === "validado") {
    throw Object.assign(
      new Error("No se puede editar un documento ya validado. Márquelo como pendiente primero."),
      { status: 400 }
    );
  }

  // Actualizar campos de la carta
  await query(
    `UPDATE documentos SET
       numero_carta = $2,
       fecha_carta = $3,
       anexo = $4,
       numero_acta = $5,
       fecha_muestra = $6,
       numero_informe = $7,
       actualizado_en = NOW()
     WHERE id = $1`,
    [
      docId,
      fields.numero_carta || null,
      fields.fecha_carta || null,
      fields.anexo || null,
      fields.numero_acta || null,
      fields.fecha_muestra || null,
      fields.numero_informe || null,
    ]
  );

  // Actualizar valores de parámetros VMA
  if (parametros && parametros.length > 0) {
    for (const p of parametros) {
      if (p.resultado_id) {
        await query(
          `UPDATE resultados_parametros 
           SET resultado_valor = $2
           WHERE id = $1`,
          [p.resultado_id, String(p.resultado_valor)]
        );
      }
    }
  }

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id, detalle)
     VALUES ($1, 'editar_documento', 'documentos', $2, $3)`,
    [userId, docId, JSON.stringify({ campos_editados: Object.keys(fields) })]
  );

  return { updated: true, documento_id: docId };
}

/**
 * Marca un documento como validado.
 * Verifica que los campos obligatorios estén completos.
 * Bloquea la edición posterior hasta que se marque como pendiente.
 *
 * @param {number} docId - ID del documento
 * @param {number} userId - ID del usuario que valida
 */
async function validateDocument(docId, userId) {
  // Verificar que el documento existe
  const docResult = await query(
    `SELECT id, estado, expediente_id, numero_carta, fecha_carta, anexo, numero_acta
     FROM documentos WHERE id = $1`,
    [docId]
  );
  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  const doc = docResult.rows[0];

  if (doc.estado === "validado") {
    throw Object.assign(new Error("El documento ya está validado"), { status: 400 });
  }

  // Validar campos obligatorios
  const faltantes = [];
  if (!doc.numero_carta) faltantes.push("Nº Carta");
  if (!doc.fecha_carta) faltantes.push("Fecha carta");
  if (!doc.anexo) faltantes.push("Anexo");
  if (!doc.numero_acta) faltantes.push("Nº Acta");

  if (faltantes.length > 0) {
    throw Object.assign(
      new Error(`Campos obligatorios vacíos: ${faltantes.join(", ")}`),
      { status: 400 }
    );
  }

  // Marcar como validado
  await query(
    `UPDATE documentos SET
       estado = 'validado',
       validado_por = $2,
       fecha_validacion = NOW(),
       actualizado_en = NOW()
     WHERE id = $1`,
    [docId, userId]
  );

  // Verificar si todos los documentos del expediente están validados
  const allDocs = await query(
    `SELECT estado FROM documentos WHERE expediente_id = $1`,
    [doc.expediente_id]
  );
  const todosValidados = allDocs.rows.every((d) => d.estado === "validado");

  if (todosValidados) {
    await query(
      `UPDATE expedientes SET estado = 'completo', actualizado_en = NOW() WHERE id = $1`,
      [doc.expediente_id]
    );
  }

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'validar_documento', 'documentos', $2)`,
    [userId, docId]
  );

  return {
    validated: true,
    documento_id: docId,
    expediente_completo: todosValidados,
  };
}

/**
 * Marca un documento validado como pendiente de revisión.
 * Desbloquea la edición de los campos.
 *
 * @param {number} docId - ID del documento
 * @param {number} userId - ID del usuario
 */
async function markDocumentPending(docId, userId) {
  const docResult = await query(
    "SELECT id, estado, expediente_id FROM documentos WHERE id = $1",
    [docId]
  );
  if (docResult.rows.length === 0) {
    throw Object.assign(new Error("Documento no encontrado"), { status: 404 });
  }

  // Revertir a procesado
  await query(
    `UPDATE documentos SET
       estado = 'procesado',
       validado_por = NULL,
       fecha_validacion = NULL,
       actualizado_en = NOW()
     WHERE id = $1`,
    [docId]
  );

  // Si el expediente estaba completo, revertir
  await query(
    `UPDATE expedientes SET estado = 'en_revision', actualizado_en = NOW()
     WHERE id = $1 AND estado = 'completo'`,
    [docResult.rows[0].expediente_id]
  );

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'revertir_validacion', 'documentos', $2)`,
    [userId, docId]
  );

  return { reverted: true, documento_id: docId };
}
