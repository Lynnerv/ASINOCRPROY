/**
 * Componente raíz de la aplicación.
 *
 * Configura:
 * - AuthProvider (contexto global de autenticación)
 * - React Router (rutas de la aplicación)
 * - ProtectedRoute (rutas que requieren login)
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Futuras rutas protegidas:
          <Route path="/expedientes" element={<ProtectedRoute><Expedientes /></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><Documentos /></ProtectedRoute>} />
          */}

          {/* Redirigir rutas desconocidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
