/**
 * Cliente HTTP para Preparar Servicio (HU-16).
 */

import api from "./auth";

export const servicioApi = {
  // Obtener datos del expediente para preparar servicio
  getDatos: (expedienteId) => api.get(`/servicio/${expedienteId}`),

  // Actualizar precio y/o fecha
  updateDatos: (expedienteId, datos) => api.patch(`/servicio/${expedienteId}`, datos),

  // Calendario mensual
  getCalendario: (anio, mes) => api.get(`/servicio/calendario/${anio}/${mes}`),

  // Generar proforma (descarga directa)
  generarProforma: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/proforma`, {}, { responseType: "blob" }),

  // Generar carta de programacion (descarga directa)
  generarProgramacion: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/programacion`, {}, { responseType: "blob" }),

  generarCertificado: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/certificado`, {}, { responseType: "blob" }),

  generarInformeTecnico: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/informe-tecnico`, {}, { responseType: "blob" }),

  generarLevantamiento: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/levantamiento`, {}, { responseType: "blob" }),

  generarFichaTecnica: (expedienteId) =>
    api.post(`/servicio/${expedienteId}/ficha-tecnica`, {}, { responseType: "blob" }),
};
