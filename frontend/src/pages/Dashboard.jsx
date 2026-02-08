/**
 * Dashboard principal (placeholder).
 *
 * Se irá completando con módulos de expedientes, documentos, etc.
 * Por ahora muestra información del usuario y permite cerrar sesión.
 */

import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  FileSearch,
  LogOut,
  User,
  FolderOpen,
  FileText,
  Upload,
} from "lucide-react";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard">
      {/* --- Header --- */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo">
            <FileSearch size={20} />
            <span>ASIN-OCR</span>
          </div>
        </div>
        <div className="dash-header-right">
          <div className="dash-user">
            <User size={16} />
            <span>{usuario?.nombre}</span>
            <span className="dash-role">{usuario?.rol}</span>
          </div>
          <button className="dash-logout" onClick={handleLogout}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      {/* --- Content --- */}
      <main className="dash-content">
        <div className="dash-welcome">
          <h1>
            Bienvenido, <span className="highlight">{usuario?.nombre}</span>
          </h1>
          <p>Sistema de Gestión Documental con OCR + IA</p>
        </div>

        <div className="dash-cards">
          <div className="dash-card">
            <div className="dash-card-icon">
              <Upload size={24} />
            </div>
            <h3>Subir Documento</h3>
            <p>Procesar cartas de notificación con OCR + Gemini</p>
            <span className="dash-card-status">Próximamente</span>
          </div>

          <div className="dash-card">
            <div className="dash-card-icon">
              <FolderOpen size={24} />
            </div>
            <h3>Expedientes</h3>
            <p>Consultar expedientes por NIS o cliente</p>
            <span className="dash-card-status">Próximamente</span>
          </div>

          <div className="dash-card">
            <div className="dash-card-icon">
              <FileText size={24} />
            </div>
            <h3>Reportes</h3>
            <p>Generar reportes y cartas poder</p>
            <span className="dash-card-status">Próximamente</span>
          </div>
        </div>
      </main>
    </div>
  );
}
