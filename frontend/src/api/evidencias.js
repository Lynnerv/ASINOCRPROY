/**
 * Cliente HTTP para evidencias del expediente (HU-11).
 */

import api from "./auth";

export const evidenciasApi = {
  // Listar evidencias + datos del expediente
  get: (expedienteId) => api.get(`/evidencias/${expedienteId}`),

  // Subir o reemplazar un archivo
  upload: (expedienteId, { tipo, orden, file, onProgress }) => {
    const fd = new FormData();
    fd.append("tipo", tipo);
    if (orden != null) fd.append("orden", String(orden));
    fd.append("archivo", file);

    return api.post(`/evidencias/${expedienteId}/upload`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  },

  // Eliminar archivo individual
  delete: (evidenciaId) => api.delete(`/evidencias/evidencia/${evidenciaId}`),

  // Actualizar N° de factura
  updateFactura: (expedienteId, numero_factura) =>
    api.patch(`/evidencias/${expedienteId}/factura`, { numero_factura }),

  // Guardar evidencias (validar y cambiar estado)
  guardar: (expedienteId) => api.post(`/evidencias/${expedienteId}/guardar`),

  // Reordenar evidencias de un tipo
  reorder: (expedienteId, tipo, ids) =>
    api.patch(`/evidencias/${expedienteId}/reorder`, { tipo, ids }),
};
