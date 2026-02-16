/**
 * Componente de ruta protegida.
 *
 * Si el usuario no está autenticado, redirige a /login.
 * Si se especifican roles, verifica que el usuario tenga uno de ellos.
 * Muestra un loader mientras verifica la sesión.
 *
 * Props:
 *   children: Componente a renderizar
 *   roles: Array de roles permitidos (opcional). Si se omite, cualquier rol accede.
 */

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
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

  // Si se especifican roles y el usuario no tiene uno de ellos
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
