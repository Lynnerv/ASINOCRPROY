/**
 * Componente raíz de la aplicación.
 *
 * Configura:
 * - AuthProvider (contexto global de autenticación)
 * - React Router (rutas de la aplicación)
 * - Layout persistente (header + footer) para rutas protegidas
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/Upload";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública (sin Layout) */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas (con Layout: header + footer) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/cargar"
            element={
              <ProtectedRoute>
                <Layout>
                  <UploadPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Redirigir rutas desconocidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
