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

  /** Visualización segura (Blob) */
  getFileBlob: (id) => api.get(`/documentos/${id}/archivo`, { 
    responseType: 'blob' 
  }),

  /** Descarga forzada original (Blob) -> ¡AQUÍ ESTABA EL ERROR! */
  downloadOriginal: (id) => api.get(`/documentos/${id}/archivo?download=1`, { 
    responseType: 'blob' 
  }),

  /** Resumen de estados */
  getProcessStatus: () => api.get("/procesar/estado"),

  /** Documentos pendientes */
  getPending: (includeErrors = false) =>
    api.get("/procesar/pendientes", {
      params: { incluir_errores: includeErrors },
    }),

  /** Iniciar procesamiento (retorna jobId) */
  startProcessing: () => api.post("/procesar/iniciar"),

  /** Procesar un documento individual */
  processOne: (docId) => api.post(`/procesar/documento/${docId}`),

  /** Job activo (si existe) */
  getActiveJob: () => api.get("/procesar/job/activo"),

  /** Estado de un job (polling) */
  getJobStatus: (jobId) => api.get(`/procesar/job/${jobId}/estado`),
};

export const expedienteApi = {
  // Panel de control
  listPending: () => api.get("/expedientes/pendientes"),
  listAll: () => api.get("/expedientes"),
  create: () => api.post("/expedientes"),
  deleteDocument: (docId) => api.delete(`/expedientes/documento/${docId}`),
  moveDocument: (docId, targetExpId) =>
    api.patch(`/expedientes/documento/${docId}/mover`, {
      expediente_destino_id: targetExpId,
    }),

  // HU-06: Ver expedientes procesados
  listProcessed: (params) => api.get("/expedientes/procesados", { params }),
  getDetail: (id) => api.get(`/expedientes/${id}/detalle`),

  // HU-07: Validación de datos
  updateDocFields: (docId, campos, parametros) =>
    api.put(`/expedientes/documento/${docId}/campos`, { campos, parametros }),
  validateDoc: (docId) =>
    api.patch(`/expedientes/documento/${docId}/validar`),
  markPending: (docId) =>
    api.patch(`/expedientes/documento/${docId}/pendiente`),

  hideExpediente: (expId) =>
    api.patch(`/expedientes/${expId}/ocultar`),
};

export const statsApi = {
  getGlobal: () => api.get("/stats"),
  getRecent: (limit = 10) => api.get("/stats/recientes", { params: { limit } }),
  getUserStats: () => api.get("/stats/usuarios"),
  getReportes: (desde, hasta) => api.get("/stats/reportes", { params: { desde, hasta } }),
  getExportData: (desde, hasta) => api.get("/stats/exportar", { params: { desde, hasta } }),
};

export const usersApi = {
  list: () => api.get("/usuarios"),
  create: (data) => api.post("/usuarios", data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  resetPassword: (id, password) =>
    api.patch(`/usuarios/${id}/password`, { password }),

  getProfile: () => api.get("/usuarios/perfil"),
  updateProfile: (data) => api.patch("/usuarios/perfil", data),
  changePassword: (data) => api.patch("/usuarios/perfil/password", data),
};
