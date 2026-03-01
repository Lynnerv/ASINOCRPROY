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
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/Upload";
import ProcessPage from "./pages/Process";
import ExpedientesPage from "./pages/ExpedientesProcessed";
import UsersPage from "./pages/Users";
import DocumentsPage from "./pages/Documents";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública (sin Layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer/:token" element={<ResetPassword />} />

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
          <Route
            path="/procesar"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProcessPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expedientes"
            element={
              <ProtectedRoute>
                <Layout>
                  <ExpedientesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
              path="/documentos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DocumentsPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
          
          {/* Solo administrador */}
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute roles={["administrador"]}>
                <Layout>
                  <UsersPage />
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
