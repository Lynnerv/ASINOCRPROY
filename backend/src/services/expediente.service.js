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
  createEmptyExpediente,
  deleteDocument,
  moveDocument,
};
