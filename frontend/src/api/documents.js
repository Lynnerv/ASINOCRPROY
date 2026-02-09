/**
 * Cliente HTTP para endpoints de documentos.
 */

import api from "./auth";

export const documentApi = {
  /**
   * Sube múltiples cartas al servidor.
   * @param {File[]} files - Archivos a subir
   * @param {Function} onProgress - Callback con porcentaje (0-100)
   * @returns {Promise} Respuesta del servidor
   */
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
};
