import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ExpedientesPage from "./pages/ExpedientesProcessed";
import UsersPage from "./pages/Users";
import Notifications from "./pages/Notifications";
import EvidenciasPage from "./pages/CompletarEvidencias";
import PrepararServicioPage from "./pages/PrepararServicio";
import Legal from "./pages/Legal";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer/:token" element={<ResetPassword />} />

          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/expedientes" element={<ProtectedRoute><Layout><ExpedientesPage /></Layout></ProtectedRoute>} />
          <Route path="/expedientes/:id/evidencias" element={<ProtectedRoute><Layout><EvidenciasPage /></Layout></ProtectedRoute>} />
          <Route path="/expedientes/:id/servicio" element={<ProtectedRoute><Layout><PrepararServicioPage /></Layout></ProtectedRoute>} />
          <Route path="/notificaciones" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute roles={["administrador"]}><Layout><UsersPage /></Layout></ProtectedRoute>} />

          {/* Rutas antiguas redireccionadas */}
          <Route path="/cargar" element={<Navigate to="/expedientes" replace />} />
          <Route path="/procesar" element={<Navigate to="/expedientes" replace />} />
          <Route path="/documentos" element={<Navigate to="/expedientes" replace />} />
          <Route path="/documentos/:id" element={<Navigate to="/expedientes" replace />} />

          {/* Legal publico */}
          <Route path="/legal" element={<Navigate to="/legal/privacidad" replace />} />
          <Route path="/legal/:section" element={<Layout><Legal /></Layout>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
