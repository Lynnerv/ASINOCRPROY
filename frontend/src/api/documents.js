/**
 * Cliente HTTP para endpoints de documentos.
 */

import api from "./auth";

export const documentApi = {
  upload: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("cartas", file));

    return api.post("/documentos/cargar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },

  list: (params) => api.get("/documentos", { params }),
  getById: (id) => api.get(`/documentos/${id}`),

  /** Resumen de estados */
  getProcessStatus: () => api.get("/procesar/estado"),

  /** Documentos pendientes */
  getPending: (includeErrors = false) =>
    api.get("/procesar/pendientes", {
      params: { incluir_errores: includeErrors },
    }),

  /** Iniciar procesamiento (retorna jobId) */
  startProcessing: () => api.post("/procesar/iniciar"),

  /** Job activo (si existe) */
  getActiveJob: () => api.get("/procesar/job/activo"),

  /** Estado de un job (polling) */
  getJobStatus: (jobId) => api.get(`/procesar/job/${jobId}/estado`),
};

export const expedienteApi = {
  /** Expedientes con documentos pendientes (panel de control) */
  listPending: () => api.get("/expedientes/pendientes"),

  /** Todos los expedientes (para selector) */
  listAll: () => api.get("/expedientes"),

  /** Crear expediente vacío */
  create: () => api.post("/expedientes"),

  /** Eliminar un documento */
  deleteDocument: (docId) => api.delete(`/expedientes/documento/${docId}`),

  /** Mover documento a otro expediente */
  moveDocument: (docId, targetExpId) =>
    api.patch(`/expedientes/documento/${docId}/mover`, {
      expediente_destino_id: targetExpId,
    }),
};
