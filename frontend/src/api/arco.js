/**
 * Cliente HTTP para solicitudes ARCO.
 *
 * NOTA: El POST es público (sin auth). Usamos axios directo
 * para no enviar el token innecesariamente.
 */

import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export const arcoApi = {
  // Público: crear solicitud ARCO
  createSolicitud: (data) => axios.post(`${API_URL}/arco/solicitudes`, data),
};
