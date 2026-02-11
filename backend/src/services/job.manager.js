/**
 * Job Manager - Motor de procesamiento persistente.
 *
 * El procesamiento OCR+Gemini corre de forma independiente en el servidor.
 * No depende de ninguna conexión HTTP/SSE.
 *
 * Arquitectura:
 *   - POST /iniciar  → crea un job y retorna jobId
 *   - GET  /job/:id  → SSE para observar progreso (puede reconectarse)
 *   - GET  /job/:id/estado → estado actual del job (polling)
 *
 * Si el operario navega a otra pestaña:
 *   - El SSE se cierra, pero el job SIGUE corriendo
 *   - Al volver, se reconecta al mismo job y ve el progreso actual
 *
 * Jobs se mantienen en memoria (suficiente para este sistema).
 */

const processService = require("./process.service");

// ── Almacén de jobs en memoria ──

const jobs = new Map();

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {'queued'|'running'|'completed'|'error'} status
 * @property {number} total
 * @property {number} current
 * @property {number} exitosos
 * @property {number} errores
 * @property {Array} results - Resultados documento por documento
 * @property {string|null} mensaje - Mensaje final
 * @property {Date} createdAt
 * @property {Date|null} completedAt
 * @property {Set<Function>} listeners - SSE listeners conectados
 */

function createJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Crea y ejecuta un job de procesamiento.
 * Retorna inmediatamente el jobId; el procesamiento corre en background.
 */
function startJob() {
  const jobId = createJobId();

  const job = {
    id: jobId,
    status: "queued",
    total: 0,
    current: 0,
    exitosos: 0,
    errores: 0,
    results: [],
    mensaje: null,
    createdAt: new Date(),
    completedAt: null,
    listeners: new Set(),
  };

  jobs.set(jobId, job);

  // Ejecutar en background (no await)
  runJob(job).catch((err) => {
    job.status = "error";
    job.mensaje = `Error interno: ${err.message}`;
    job.completedAt = new Date();
    notifyListeners(job, "error_job", { mensaje: job.mensaje });
  });

  return jobId;
}

/**
 * Ejecuta el procesamiento de todos los documentos pendientes.
 * Corre de forma independiente — no depende de ninguna conexión.
 */
async function runJob(job) {
  const estados = ["pendiente", "error"];
  const docs = await processService.getPendingDocuments(estados);

  if (docs.length === 0) {
    job.status = "completed";
    job.mensaje = "No hay documentos pendientes de procesamiento.";
    job.completedAt = new Date();
    notifyListeners(job, "completo", buildFinalPayload(job));
    return;
  }

  job.total = docs.length;
  job.status = "running";
  notifyListeners(job, "inicio", { total: docs.length });

  for (let i = 0; i < docs.length; i++) {
    const result = await processService.processDocument(docs[i]);

    if (result.estado === "procesado") {
      job.exitosos++;
    } else {
      job.errores++;
    }

    job.current = i + 1;
    job.results.push(result);

    notifyListeners(job, "progreso", {
      current: job.current,
      total: job.total,
      documento_id: result.id,
      nombre_archivo: result.nombre_archivo,
      estado: result.estado,
      error: result.error || null,
    });
  }

  // Finalizar
  job.status = "completed";
  job.completedAt = new Date();

  if (job.errores === 0) {
    job.mensaje = `Procesamiento completado. Se extrajeron los datos de ${job.exitosos} cartas.`;
  } else if (job.exitosos === 0) {
    job.mensaje = `Error en el procesamiento de ${job.errores} carta(s). Revisar en la bandeja de pendientes.`;
  } else {
    job.mensaje = `Procesamiento completado. Se extrajeron los datos de ${job.exitosos} cartas. Error en ${job.errores} carta(s).`;
  }

  notifyListeners(job, "completo", buildFinalPayload(job));
}

/**
 * Construye el payload del evento final.
 */
function buildFinalPayload(job) {
  return {
    exitosos: job.exitosos,
    errores: job.errores,
    total: job.total,
    mensaje: job.mensaje,
  };
}

/**
 * Notifica a todos los listeners SSE conectados.
 * Si un listener falla (cliente desconectado), se elimina silenciosamente.
 */
function notifyListeners(job, event, data) {
  for (const listener of job.listeners) {
    try {
      listener(event, data);
    } catch {
      job.listeners.delete(listener);
    }
  }
}

/**
 * Registra un listener SSE en un job.
 * Al conectarse, recibe todo el historial acumulado hasta el momento.
 */
function subscribe(jobId, sendEvent) {
  const job = jobs.get(jobId);
  if (!job) return null;

  // Enviar estado actual (replay del historial)
  if (job.total > 0) {
    sendEvent("inicio", { total: job.total });
  }

  // Replay de resultados anteriores
  for (let i = 0; i < job.results.length; i++) {
    const r = job.results[i];
    sendEvent("progreso", {
      current: i + 1,
      total: job.total,
      documento_id: r.id,
      nombre_archivo: r.nombre_archivo,
      estado: r.estado,
      error: r.error || null,
    });
  }

  // Si ya terminó, enviar resultado final
  if (job.status === "completed" || job.status === "error") {
    sendEvent("completo", buildFinalPayload(job));
    return job;
  }

  // Si sigue corriendo, registrar listener para eventos futuros
  job.listeners.add(sendEvent);
  return job;
}

/**
 * Desuscribe un listener SSE.
 */
function unsubscribe(jobId, sendEvent) {
  const job = jobs.get(jobId);
  if (job) {
    job.listeners.delete(sendEvent);
  }
}

/**
 * Obtiene el estado actual de un job (para polling).
 */
function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    total: job.total,
    current: job.current,
    exitosos: job.exitosos,
    errores: job.errores,
    mensaje: job.mensaje,
    results: job.results,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

/**
 * Verifica si hay un job activo (running).
 */
function getActiveJob() {
  for (const [id, job] of jobs) {
    if (job.status === "running" || job.status === "queued") {
      return getJobStatus(id);
    }
  }
  return null;
}

/**
 * Limpia jobs antiguos completados (más de 1 hora).
 */
function cleanOldJobs() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.completedAt && job.completedAt.getTime() < oneHourAgo) {
      jobs.delete(id);
    }
  }
}

// Limpiar cada 30 minutos
setInterval(cleanOldJobs, 30 * 60 * 1000);

module.exports = {
  startJob,
  subscribe,
  unsubscribe,
  getJobStatus,
  getActiveJob,
};
