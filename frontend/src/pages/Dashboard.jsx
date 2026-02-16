/**
 * Dashboard principal (HU-03) — Diferenciado por rol.
 *
 * Administrador: estadísticas globales, gestión de usuarios, configuración.
 * Operador: bandeja de documentos, carga, procesamiento, reportes.
 * Rol no definido: mensaje "contactar al administrador".
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { statsApi } from "../api/documents";
import {
  Upload, FolderOpen, FileText, FileCheck, Clock,
  BarChart3, Cpu, Users, AlertTriangle, Loader,
} from "lucide-react";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, recentRes] = await Promise.all([
          statsApi.getGlobal(),
          statsApi.getRecent(8),
        ]);
        setStats(statsRes.data);
        setRecent(recentRes.data.documentos);
      } catch (err) {
        console.error("Error cargando stats:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const rol = usuario?.rol;
  const docs = stats?.documentos || {};

  // ── Rol no definido ──
  if (rol !== "administrador" && rol !== "operador") {
    return (
      <div className="dashboard">
        <div className="no-role">
          <AlertTriangle size={40} />
          <h2>Acceso limitado</h2>
          <p>Su cuenta no tiene un rol asignado o no tiene permisos configurados.</p>
          <p className="no-role-contact">Contactar al administrador del sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome */}
      <section className="welcome-section">
        <div className="welcome-text">
          <h1>
            Bienvenido, <span className="highlight">{usuario?.nombre}</span>
          </h1>
          <p>
            {rol === "administrador"
              ? "Panel de administración del sistema de gestión documental."
              : "Gestiona las cartas de notificación de Sedapal."}
          </p>
        </div>
        {rol === "operador" && (
          <Link to="/cargar" className="welcome-action">
            <Upload size={18} />
            Cargar Cartas
          </Link>
        )}
      </section>

      {/* Stats */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-blue"><FileText size={20} /></div>
          <div className="stat-data">
            <span className="stat-value">{loading ? "..." : docs.total ?? 0}</span>
            <span className="stat-label">Documentos cargados</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-green"><FileCheck size={20} /></div>
          <div className="stat-data">
            <span className="stat-value">{loading ? "..." : docs.procesados ?? 0}</span>
            <span className="stat-label">Procesados</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-amber"><Clock size={20} /></div>
          <div className="stat-data">
            <span className="stat-value">{loading ? "..." : docs.pendientes ?? 0}</span>
            <span className="stat-label">Pendientes</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-purple"><BarChart3 size={20} /></div>
          <div className="stat-data">
            <span className="stat-value">{loading ? "..." : stats?.expedientes ?? 0}</span>
            <span className="stat-label">Expedientes</span>
          </div>
        </div>
      </section>

      {/* Quick actions — diferenciadas por rol */}
      <section className="actions-section">
        <h2>Acciones rápidas</h2>
        <div className="actions-grid">
          {/* ── Administrador ── */}
          {rol === "administrador" && (
            <>
              <Link to="/usuarios" className="action-card action-card-link">
                <div className="action-icon action-indigo"><Users size={22} /></div>
                <div className="action-body">
                  <h3>Gestión de Usuarios</h3>
                  <p>Administrar cuentas, roles y permisos del sistema</p>
                </div>
              </Link>

              <Link to="/procesar" className="action-card action-card-link">
                <div className="action-icon action-cyan"><Cpu size={22} /></div>
                <div className="action-body">
                  <h3>Procesar Contenido</h3>
                  <p>Supervisar extracción OCR + IA de documentos</p>
                </div>
              </Link>

              <Link to="/cargar" className="action-card action-card-link">
                <div className="action-icon action-blue"><Upload size={22} /></div>
                <div className="action-body">
                  <h3>Cargar Cartas</h3>
                  <p>Subir imágenes JPG o PNG para procesamiento</p>
                </div>
              </Link>

              <div className="action-card action-card-disabled">
                <div className="action-icon action-violet"><BarChart3 size={22} /></div>
                <div className="action-body">
                  <h3>Estadísticas Globales</h3>
                  <p>Métricas de rendimiento y uso del sistema</p>
                  <span className="action-badge">Próximamente</span>
                </div>
              </div>
            </>
          )}

          {/* ── Operador ── */}
          {rol === "operador" && (
            <>
              <Link to="/cargar" className="action-card action-card-link">
                <div className="action-icon action-blue"><Upload size={22} /></div>
                <div className="action-body">
                  <h3>Cargar Cartas</h3>
                  <p>Subir imágenes JPG o PNG para extracción automática</p>
                </div>
              </Link>

              <Link to="/procesar" className="action-card action-card-link">
                <div className="action-icon action-cyan"><Cpu size={22} /></div>
                <div className="action-body">
                  <h3>Procesar Contenido</h3>
                  <p>Extraer datos de cartas pendientes con OCR + IA</p>
                </div>
              </Link>

              <div className="action-card action-card-disabled">
                <div className="action-icon action-teal"><FolderOpen size={22} /></div>
                <div className="action-body">
                  <h3>Expedientes</h3>
                  <p>Consultar expedientes agrupados por cliente</p>
                  <span className="action-badge">Próximamente</span>
                </div>
              </div>

              <div className="action-card action-card-disabled">
                <div className="action-icon action-violet"><FileText size={22} /></div>
                <div className="action-body">
                  <h3>Reportes</h3>
                  <p>Generar reportes y borradores de cartas poder</p>
                  <span className="action-badge">Próximamente</span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Recent documents */}
      {recent.length > 0 && (
        <section className="recent-section">
          <h2>Documentos recientes</h2>
          <div className="recent-table-wrapper">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Cliente</th>
                  <th>Anexo</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((doc) => (
                  <tr key={doc.id}>
                    <td className="rt-name">{doc.nombre_archivo}</td>
                    <td className="rt-client">
                      {doc.nis ? `${doc.nis} - ${doc.cliente}` : "—"}
                    </td>
                    <td>
                      {doc.anexo ? (
                        <span className="rt-anexo">{doc.anexo}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`rt-status st-${doc.estado}`}>
                        {doc.estado}
                      </span>
                    </td>
                    <td className="rt-date">
                      {new Date(doc.creado_en).toLocaleDateString("es-PE", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
