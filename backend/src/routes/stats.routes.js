/**
 * Rutas de estadísticas del dashboard.
 *
 * GET /api/stats           → Estadísticas globales (ambos roles)
 * GET /api/stats/recientes → Documentos recientes
 * GET /api/stats/usuarios  → Stats de usuarios (solo admin)
 */

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const statsService = require("../services/stats.service");

const router = Router();

router.get("/", auth, async (req, res, next) => {
  try {
    const stats = await statsService.getGlobalStats();
    res.json(stats);
  } catch (err) { next(err); }
});

router.get("/recientes", auth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const docs = await statsService.getRecentDocuments(limit);
    res.json({ documentos: docs });
  } catch (err) { next(err); }
});

router.get("/usuarios", auth, authorize("administrador"), async (req, res, next) => {
  try {
    const stats = await statsService.getUserStats();
    res.json(stats);
  } catch (err) { next(err); }
});

module.exports = router;
