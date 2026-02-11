/**
 * Dashboard principal.
 *
 * Header y footer son manejados por Layout.
 * Esta página solo muestra contenido del área principal.
 */

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Upload,
  FolderOpen,
  FileText,
  FileCheck,
  Clock,
  BarChart3,
  Cpu,
} from "lucide-react";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { usuario } = useAuth();

  return (
    <div className="dashboard">
      {/* Welcome */}
      <section className="welcome-section">
        <div className="welcome-text">
          <h1>
            Bienvenido, <span className="highlight">{usuario?.nombre}</span>
          </h1>
          <p>Gestiona las cartas de notificación de Sedapal desde un solo lugar.</p>
        </div>
        <Link to="/cargar" className="welcome-action">
          <Upload size={18} />
          Cargar Cartas
        </Link>
      </section>

      {/* Stats */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-blue">
            <FileText size={20} />
          </div>
          <div className="stat-data">
            <span className="stat-value">—</span>
            <span className="stat-label">Documentos cargados</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-green">
            <FileCheck size={20} />
          </div>
          <div className="stat-data">
            <span className="stat-value">—</span>
            <span className="stat-label">Procesados con éxito</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-amber">
            <Clock size={20} />
          </div>
          <div className="stat-data">
            <span className="stat-value">—</span>
            <span className="stat-label">Pendientes</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-purple">
            <BarChart3 size={20} />
          </div>
          <div className="stat-data">
            <span className="stat-value">—</span>
            <span className="stat-label">Expedientes</span>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="actions-section">
        <h2>Acciones rápidas</h2>
        <div className="actions-grid">
          <Link to="/cargar" className="action-card action-card-link">
            <div className="action-icon action-blue">
              <Upload size={22} />
            </div>
            <div className="action-body">
              <h3>Cargar Cartas</h3>
              <p>Subir imagenes JPG o PNG para extraccion automatica</p>
            </div>
          </Link>

          <Link to="/procesar" className="action-card action-card-link">
            <div className="action-icon action-cyan">
              <Cpu size={22} />
            </div>
            <div className="action-body">
              <h3>Procesar Contenido</h3>
              <p>Extraer datos de cartas pendientes con OCR + IA</p>
            </div>
          </Link>

          <div className="action-card action-card-disabled">
            <div className="action-icon action-teal">
              <FolderOpen size={22} />
            </div>
            <div className="action-body">
              <h3>Expedientes</h3>
              <p>Consultar expedientes agrupados por NIS</p>
              <span className="action-badge">Próximamente</span>
            </div>
          </div>

          <div className="action-card action-card-disabled">
            <div className="action-icon action-violet">
              <FileText size={22} />
            </div>
            <div className="action-body">
              <h3>Reportes</h3>
              <p>Generar reportes y borradores de cartas poder</p>
              <span className="action-badge">Próximamente</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
