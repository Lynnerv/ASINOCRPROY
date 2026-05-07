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

// HU-11: Evidencias
import EvidenciasPage from "./pages/CompletarEvidencias";

// HU-16: Preparar servicio
import PrepararServicioPage from "./pages/PrepararServicio";

// Legal (Ley 29733 + ISO 27001/27701)
import Legal from "./pages/Legal";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer/:token" element={<ResetPassword />} />

          {/* Protegidas */}
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/cargar" element={<ProtectedRoute><Layout><UploadPage /></Layout></ProtectedRoute>} />
          <Route path="/procesar" element={<ProtectedRoute><Layout><ProcessPage /></Layout></ProtectedRoute>} />
          <Route path="/expedientes" element={<ProtectedRoute><Layout><ExpedientesPage /></Layout></ProtectedRoute>} />
          <Route path="/expedientes/:id/evidencias" element={<ProtectedRoute><Layout><EvidenciasPage /></Layout></ProtectedRoute>} />
          <Route path="/expedientes/:id/servicio" element={<ProtectedRoute><Layout><PrepararServicioPage /></Layout></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><Layout><DocumentsPage /></Layout></ProtectedRoute>} />
          <Route path="/documentos/:id" element={<ProtectedRoute><Layout><DocumentDetail /></Layout></ProtectedRoute>} />
          <Route path="/notificaciones" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute roles={["administrador"]}><Layout><UsersPage /></Layout></ProtectedRoute>} />

          {/* Legal (público, dentro del Layout — Ley 29733 exige acceso sin restricciones) */}
          <Route path="/legal" element={<Navigate to="/legal/privacidad" replace />} />
          <Route path="/legal/:section" element={<Layout><Legal /></Layout>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
