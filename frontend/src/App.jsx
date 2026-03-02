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

// HU-08 y HU-09
import DocumentsPage from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";

// HU-10
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer/:token" element={<ResetPassword />} />

          {/* Protegidas */}
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

          {/* HU-08: listado */}
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

          {/* HU-09: detalle */}
          <Route
            path="/documentos/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <DocumentDetail />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* HU-10: notificaciones */}
          <Route
            path="/notificaciones"
            element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}