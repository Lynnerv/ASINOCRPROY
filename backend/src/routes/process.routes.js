/**
 * Rutas de procesamiento (HU-05) — con persistencia via jobs.
 *
 * GET  /api/procesar/estado          → Resumen de estados
 * GET  /api/procesar/pendientes      → Documentos pendientes
 * POST /api/procesar/iniciar         → Lanzar job (retorna jobId)
 * GET  /api/procesar/job/activo      → Job activo (si existe)
 * GET  /api/procesar/job/:id         → SSE: observar progreso
 * GET  /api/procesar/job/:id/estado  → Polling: estado del job
 */

const { Router } = require("express");
const jwt = require("jsonwebtoken");

const ctrl = require("../controllers/process.controller");
const auth = require("../middlewares/auth.middleware");

const router = Router();

/**
 * Auth SSE: EventSource no soporta headers, token va en query param.
 */
function authSSE(req, res, next) {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: decoded.id, correo: decoded.correo, rol: decoded.rol };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Rutas con auth por header
router.get("/estado", auth, ctrl.getStatus);
router.get("/pendientes", auth, ctrl.getPending);
router.post("/iniciar", auth, ctrl.startProcessing);
router.get("/job/activo", auth, ctrl.getActiveJob);

// Polling estado (auth por header)
router.get("/job/:id/estado", auth, ctrl.getJobStatus);

// SSE con auth por query param (EventSource limitation)
router.get("/job/:id", authSSE, ctrl.subscribeToJob);

module.exports = router;
