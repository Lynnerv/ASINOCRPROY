const express = require("express");
const router = express.Router();
const { query } = require("../config/database");
const authMiddleware = require("../middlewares/auth.middleware");

// GET /api/notificaciones
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.usuario.id;
    const { tipo, solo_no_leidas } = req.query;

    const params = [userId];
    let where = `usuario_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`;

    if (tipo && tipo !== "TODAS") {
      params.push(tipo);
      where += ` AND tipo = $${params.length}`;
    }

    if (solo_no_leidas === "1") {
      where += ` AND leida = false`;
    }

    const { rows } = await query(
      `SELECT id, tipo, titulo, mensaje, referencia_tipo, referencia_id, leida, created_at
       FROM notificaciones
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      params
    );

    res.json({ notificaciones: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/notificaciones/unread-count
router.get("/unread-count", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.usuario.id;

    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM notificaciones
       WHERE usuario_id = $1
         AND leida = false
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    res.json({ count: rows[0]?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notificaciones/:id/leida
router.patch("/:id/leida", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.usuario.id;
    const { id } = req.params;

    const { rowCount } = await query(
      `UPDATE notificaciones
       SET leida = true
       WHERE id = $1 AND usuario_id = $2`,
      [id, userId]
    );

    res.json({ ok: rowCount === 1 });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notificaciones/marcar-todas
router.patch("/marcar-todas", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.usuario.id;

    await query(
      `UPDATE notificaciones
       SET leida = true
       WHERE usuario_id = $1
         AND leida = false
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;