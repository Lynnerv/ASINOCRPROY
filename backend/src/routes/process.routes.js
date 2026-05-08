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

// Procesar un documento individual (para el modal de carga rapida)
router.post("/documento/:docId", auth, async (req, res, next) => {
  try {
    const docId = parseInt(req.params.docId);
    const { query: dbQuery } = require("../config/database");
    const { processDocument } = require("../services/process.service");

    const result = await dbQuery(
      `SELECT id, expediente_id, ruta_archivo, nombre_archivo, subido_por
       FROM documentos WHERE id = $1`,
      [docId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const doc = result.rows[0];
    if (!doc.subido_por) doc.subido_por = req.usuario.id;

    const procesado = await processDocument(doc);
    res.json(procesado);
  } catch (err) {
    next(err);
  }
});

router.get("/job/activo", auth, ctrl.getActiveJob);

// Polling estado (auth por header)
router.get("/job/:id/estado", auth, ctrl.getJobStatus);

// SSE con auth por query param (EventSource limitation)
router.get("/job/:id", authSSE, ctrl.subscribeToJob);

module.exports = router;
