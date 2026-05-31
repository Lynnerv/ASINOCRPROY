const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const { query } = require("../config/database");

router.get("/", auth, authorize("administrador"), async (req, res, next) => {
  try {
    const { usuario, accion, desde, hasta, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;

    if (usuario) {
      where += ` AND h.usuario_id = $${idx++}`;
      params.push(parseInt(usuario));
    }
    if (accion) {
      where += ` AND h.accion = $${idx++}`;
      params.push(accion);
    }
    if (desde) {
      where += ` AND h.creado_en >= $${idx++}`;
      params.push(desde);
    }
    if (hasta) {
      where += ` AND h.creado_en <= $${idx++}::date + interval '1 day'`;
      params.push(hasta);
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM historial_acciones h ${where}`, params
    );

    const dataResult = await query(
      `SELECT h.id, h.accion, h.entidad, h.entidad_id, h.detalle, h.ip_address, h.creado_en,
              u.nombre AS usuario_nombre, u.correo AS usuario_correo
       FROM historial_acciones h
       LEFT JOIN usuarios u ON h.usuario_id = u.id
       ${where}
       ORDER BY h.creado_en DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    const accionesResult = await query(
      `SELECT DISTINCT accion FROM historial_acciones ORDER BY accion`
    );

    const usuariosResult = await query(
      `SELECT DISTINCT u.id, u.nombre FROM historial_acciones h
       JOIN usuarios u ON h.usuario_id = u.id ORDER BY u.nombre`
    );

    res.json({
      registros: dataResult.rows,
      total: countResult.rows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
      filtros: {
        acciones: accionesResult.rows.map(r => r.accion),
        usuarios: usuariosResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
