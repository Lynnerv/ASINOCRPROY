/**
 * Servicio de estadísticas para el dashboard.
 *
 * Provee conteos reales desde la BD para:
 *   - Resumen global (admin): total docs, procesados, pendientes, errores, expedientes, clientes
 *   - Documentos recientes (ambos roles)
 */

const { query } = require("../config/database");

/**
 * Estadísticas globales del sistema.
 */
async function getGlobalStats() {
  const [docsRes, expRes, clientesRes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'procesado')::int AS procesados,
        COUNT(*) FILTER (WHERE estado = 'validado')::int AS validados,
        COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'error')::int AS errores
      FROM documentos
    `),
    query("SELECT COUNT(*)::int AS total FROM expedientes"),
    query("SELECT COUNT(*)::int AS total FROM clientes"),
  ]);

  const docs = docsRes.rows[0];

  return {
    documentos: {
      total: docs.total,
      procesados: docs.procesados,
      validados: docs.validados,
      pendientes: docs.pendientes,
      errores: docs.errores,
    },
    expedientes: expRes.rows[0].total,
    clientes: clientesRes.rows[0].total,
  };
}

/**
 * Documentos recientes (últimos N).
 */
async function getRecentDocuments(limit = 10) {
  const result = await query(
    `SELECT d.id, d.nombre_archivo, d.anexo, d.estado,
            d.numero_carta, d.fecha_carta, d.creado_en,
            c.nis, c.nombre AS cliente
     FROM documentos d
     JOIN expedientes e ON d.expediente_id = e.id
     LEFT JOIN clientes c ON e.cliente_id = c.id
     ORDER BY d.creado_en DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Conteo de usuarios por rol (solo admin).
 */
async function getUserStats() {
  const result = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE rol = 'administrador')::int AS administradores,
      COUNT(*) FILTER (WHERE rol = 'operador')::int AS operadores,
      COUNT(*) FILTER (WHERE activo = true)::int AS activos
    FROM usuarios
  `);
  return result.rows[0];
}

module.exports = { getGlobalStats, getRecentDocuments, getUserStats };
