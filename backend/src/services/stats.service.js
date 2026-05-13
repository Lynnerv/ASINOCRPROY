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

module.exports = { getGlobalStats, getRecentDocuments, getUserStats, getReporteEstadisticas, getExportData };

async function getReporteEstadisticas(fechaInicio, fechaFin) {
  const params = [];
  let dateFilter = "";

  if (fechaInicio && fechaFin) {
    params.push(fechaInicio, fechaFin);
    dateFilter = `AND e.creado_en >= $1 AND e.creado_en <= $2`;
  }

  const [resumen, porMes, porEstado, topClientes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS total_expedientes,
        COUNT(*) FILTER (WHERE e.estado IN ('completo','servicio_programado','evidencias_cargadas','listo_para_generar','generado','cerrado'))::int AS completados,
        COUNT(*) FILTER (WHERE e.estado IN ('pendiente','procesado','en_revision'))::int AS en_proceso,
        COUNT(*) FILTER (WHERE e.estado = 'servicio_programado')::int AS programados,
        COALESCE(SUM(e.precio_servicio), 0)::numeric AS ingreso_total
      FROM expedientes e
      WHERE (e.visible IS NULL OR e.visible = true) ${dateFilter}
    `, params),

    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', e.creado_en), 'YYYY-MM') AS mes,
        COUNT(*)::int AS cantidad
      FROM expedientes e
      WHERE (e.visible IS NULL OR e.visible = true) ${dateFilter}
      GROUP BY DATE_TRUNC('month', e.creado_en)
      ORDER BY mes ASC
    `, params),

    query(`
      SELECT e.estado, COUNT(*)::int AS cantidad
      FROM expedientes e
      WHERE (e.visible IS NULL OR e.visible = true) ${dateFilter}
      GROUP BY e.estado
      ORDER BY cantidad DESC
    `, params),

    query(`
      SELECT c.nombre AS cliente, c.nis, COUNT(e.id)::int AS expedientes
      FROM expedientes e
      JOIN clientes c ON e.cliente_id = c.id
      WHERE (e.visible IS NULL OR e.visible = true) ${dateFilter}
      GROUP BY c.id, c.nombre, c.nis
      ORDER BY expedientes DESC
      LIMIT 10
    `, params),
  ]);

  return {
    resumen: resumen.rows[0],
    porMes: porMes.rows,
    porEstado: porEstado.rows,
    topClientes: topClientes.rows,
  };
}

async function getExportData(fechaInicio, fechaFin) {
  const params = [];
  let dateFilter = "";

  if (fechaInicio && fechaFin) {
    params.push(fechaInicio, fechaFin);
    dateFilter = `AND e.creado_en >= $1 AND e.creado_en <= $2`;
  }

  const result = await query(`
    SELECT
      e.id AS expediente_id,
      e.estado,
      e.precio_servicio,
      e.fecha_programacion,
      e.creado_en,
      c.nis,
      c.nombre AS cliente,
      c.direccion,
      c.distrito,
      COUNT(d.id)::int AS num_documentos,
      STRING_AGG(DISTINCT d.anexo, ', ') AS anexos
    FROM expedientes e
    LEFT JOIN clientes c ON e.cliente_id = c.id
    LEFT JOIN documentos d ON d.expediente_id = e.id
    WHERE (e.visible IS NULL OR e.visible = true) ${dateFilter}
    GROUP BY e.id, c.id
    ORDER BY e.creado_en DESC
  `, params);

  return result.rows;
}
