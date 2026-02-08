/**
 * Contexto de autenticación.
 *
 * Provee estado global de sesión (usuario, token) a toda la app.
 * Persiste en localStorage para mantener sesión entre recargas.
 */

import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar: verificar si hay sesión guardada
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("usuario");

    if (token && saved) {
      try {
        setUsuario(JSON.parse(saved));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      }
    }
    setLoading(false);
  }, []);

  async function login(correo, password) {
    const { data } = await authApi.login(correo, password);
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
