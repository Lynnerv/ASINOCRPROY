/**
 * Cliente HTTP para endpoints de autenticación.
 *
 * Usa axios con interceptores para:
 * - Agregar token JWT automáticamente a cada request.
 * - Manejar errores 401 (token expirado → redirect a login).
 */

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Interceptor: agregar token a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejar errores de autenticación
// Excluye /auth/login para que el componente Login maneje sus propios errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (correo, password) => api.post("/auth/login", { correo, password }),
  getProfile: () => api.get("/auth/perfil"),
  createUser: (data) => api.post("/auth/usuarios", data),
};

export default api;