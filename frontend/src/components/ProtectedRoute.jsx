/**
 * Componente de ruta protegida.
 *
 * Si el usuario no está autenticado, redirige a /login.
 * Muestra un loader mientras verifica la sesión.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "var(--color-text-secondary)",
        }}
      >
        Cargando...
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
