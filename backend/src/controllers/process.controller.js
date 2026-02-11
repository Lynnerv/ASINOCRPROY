/**
 * Controlador de procesamiento (HU-05) — con persistencia.
 *
 * El procesamiento corre en el servidor de forma independiente.
 * Si el operario navega a otra pestaña, el proceso NO se interrumpe.
 *
 * Endpoints:
 *   GET  /api/procesar/estado     → Resumen de estados de documentos
 *   GET  /api/procesar/pendientes → Documentos pendientes
 *   POST /api/procesar/iniciar    → Lanza job de procesamiento (retorna jobId)
 *   GET  /api/procesar/job/activo → Job activo (si existe)
 *   GET  /api/procesar/job/:id    → SSE: observar progreso de un job
 *   GET  /api/procesar/job/:id/estado → Estado del job (polling)
 */

const processService = require("../services/process.service");
const jobManager = require("../services/job.manager");

/**
 * GET /api/procesar/estado
 */
async function getStatus(req, res, next) {
  try {
    const summary = await processService.getStatusSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/procesar/pendientes
 */
async function getPending(req, res, next) {
  try {
    const includeErrors = req.query.incluir_errores === "true";
    const estados = includeErrors ? ["pendiente", "error"] : ["pendiente"];
    const docs = await processService.getPendingDocuments(estados);
    res.json({ documentos: docs, total: docs.length });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/procesar/iniciar
 * Lanza un job de procesamiento en background.
 * Retorna inmediatamente con el jobId.
 */
function startProcessing(req, res) {
  // Verificar que no haya un job activo
  const active = jobManager.getActiveJob();
  if (active) {
    return res.status(409).json({
      error: "Ya hay un procesamiento en curso.",
      job_id: active.id,
    });
  }

  const jobId = jobManager.startJob();

  res.status(202).json({
    mensaje: "Procesamiento iniciado.",
    job_id: jobId,
  });
}

/**
 * GET /api/procesar/job/activo
 * Retorna el job activo si existe.
 */
function getActiveJob(req, res) {
  const active = jobManager.getActiveJob();
  res.json({ job: active });
}

/**
 * GET /api/procesar/job/:id/estado
 * Estado del job por polling (alternativa a SSE).
 */
function getJobStatus(req, res) {
  const job = jobManager.getJobStatus(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job no encontrado" });
  }
  res.json({ job });
}

/**
 * GET /api/procesar/job/:id
 * SSE: observar progreso de un job en tiempo real.
 *
 * Al conectarse:
 *   - Recibe replay de todo el historial acumulado
 *   - Si el job sigue corriendo, recibe eventos futuros
 *   - Si el job ya terminó, recibe el resultado final e inmediatamente cierra
 *
 * Si se desconecta y reconecta, recibe el historial completo de nuevo.
 */
function subscribeToJob(req, res) {
  const jobId = req.params.id;

  // Verificar que existe
  const jobStatus = jobManager.getJobStatus(jobId);
  if (!jobStatus) {
    return res.status(404).json({ error: "Job no encontrado" });
  }

  // Configurar SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Listener
  function sendEvent(event, data) {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  // Suscribirse (recibe replay + eventos futuros)
  const job = jobManager.subscribe(jobId, sendEvent);

  // Si ya terminó, cerrar la conexión
  if (job && (job.status === "completed" || job.status === "error")) {
    res.end();
    return;
  }

  // Cleanup al desconectarse
  req.on("close", () => {
    jobManager.unsubscribe(jobId, sendEvent);
  });
}

module.exports = {
  getStatus,
  getPending,
  startProcessing,
  getActiveJob,
  getJobStatus,
  subscribeToJob,
};
