/**
 * Rutas de Solicitudes ARCO (Ley 29733).
 *
 * POST /api/arco/solicitudes       → Crear solicitud (PÚBLICO, sin auth)
 * GET  /api/arco/solicitudes       → Listar solicitudes (solo admin)
 */

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");
const arcoService = require("../services/arco.service");

const router = Router();

// POST público para que cualquier persona pueda enviar su solicitud
router.post("/solicitudes", async (req, res, next) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const result = await arcoService.createSolicitud(req.body, ip);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET solo para administradores
router.get("/solicitudes", auth, role("administrador"), async (req, res, next) => {
  try {
    const estado = req.query.estado || null;
    const tipo_solicitud = req.query.tipo || null;
    const solicitudes = await arcoService.listSolicitudes({ estado, tipo_solicitud });
    res.json({ solicitudes });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
