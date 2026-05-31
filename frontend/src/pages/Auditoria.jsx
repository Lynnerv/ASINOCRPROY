import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import api from "../api/auth";
import "../styles/auditoria.css";

const ACCION_LABELS = {
  login: "Inicio de sesion",
  crear_expediente: "Crear expediente",
  procesar_documento: "Procesar documento",
  validar_documento: "Validar documento",
  desbloquear_documento: "Desbloquear documento",
  editar_documento: "Editar documento",
  revertir_validacion: "Revertir validacion",
  preparar_servicio: "Preparar servicio",
  completar_evidencias: "Completar evidencias",
  ocultar_expediente: "Ocultar expediente",
  crear_usuario: "Crear usuario",
  editar_usuario: "Editar usuario",
  cambiar_password: "Cambiar contrasena",
};

const ACCION_COLORS = {
  login: "#3b82f6",
  crear_expediente: "#22c55e",
  procesar_documento: "#8b5cf6",
  validar_documento: "#14b8a6",
  desbloquear_documento: "#f59e0b",
  editar_documento: "#64748b",
  revertir_validacion: "#f97316",
  preparar_servicio: "#6366f1",
  completar_evidencias: "#ec4899",
  ocultar_expediente: "#ef4444",
  crear_usuario: "#22c55e",
  editar_usuario: "#f59e0b",
  cambiar_password: "#94a3b8",
};

export default function Auditoria() {
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [acciones, setAcciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const loadData = useCallback(async (p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit });
      if (filtroUsuario) params.append("usuario", filtroUsuario);
      if (filtroAccion) params.append("accion", filtroAccion);
      if (filtroDesde) params.append("desde", filtroDesde);
      if (filtroHasta) params.append("hasta", filtroHasta);

      const { data } = await api.get(`/auditoria?${params}`);
      setRegistros(data.registros);
      setTotal(data.total);
      if (data.filtros) {
        setAcciones(data.filtros.acciones || []);
        setUsuarios(data.filtros.usuarios || []);
      }
    } catch (err) {
      console.error("Error cargando auditoria:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroUsuario, filtroAccion, filtroDesde, filtroHasta, limit]);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  function handleFilter() {
    setPage(1);
  }

  function clearFilters() {
    setFiltroUsuario("");
    setFiltroAccion("");
    setFiltroDesde("");
    setFiltroHasta("");
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatHora(fecha) {
    return new Date(fecha).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="aud-page">
      <div className="aud-header">
        <div>
          <h1>Registro de auditoria</h1>
          <p>Historial de acciones realizadas en el sistema</p>
        </div>
        <span className="aud-total">{total} registros</span>
      </div>

      <div className="aud-filters">
        <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
        <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {acciones.map((a) => (
            <option key={a} value={a}>{ACCION_LABELS[a] || a}</option>
          ))}
        </select>
        <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
        <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
        <button className="btn btn-primary aud-filter-btn" onClick={handleFilter}>
          <Filter size={14} /> Filtrar
        </button>
        {(filtroUsuario || filtroAccion || filtroDesde || filtroHasta) && (
          <button className="btn btn-ghost aud-clear-btn" onClick={clearFilters}>Limpiar</button>
        )}
      </div>

      <div className="aud-table-wrap">
        {loading ? (
          <div className="aud-loading">Cargando registros...</div>
        ) : registros.length === 0 ? (
          <div className="aud-empty">No se encontraron registros con los filtros aplicados.</div>
        ) : (
          <table className="aud-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Accion</th>
                <th>Entidad</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td className="aud-fecha">{formatFecha(r.creado_en)}</td>
                  <td className="aud-hora">{formatHora(r.creado_en)}</td>
                  <td className="aud-usuario">{r.usuario_nombre || "Sistema"}</td>
                  <td>
                    <span className="aud-accion-badge" style={{ background: `${ACCION_COLORS[r.accion] || "#6b7280"}18`, color: ACCION_COLORS[r.accion] || "#6b7280" }}>
                      {ACCION_LABELS[r.accion] || r.accion}
                    </span>
                  </td>
                  <td className="aud-entidad">{r.entidad}</td>
                  <td className="aud-entidad-id">#{r.entidad_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="aud-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button>
          <span>Pagina {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
