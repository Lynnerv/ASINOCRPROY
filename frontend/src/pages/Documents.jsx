import { useEffect, useMemo, useState } from "react";
import { documentApi } from "../api/documents";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  Eye,
  Loader,
} from "lucide-react";
import "../styles/documents.css";

// Estados que quieres mostrar (UI)
const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_revision", label: "En revisión" },
  { value: "procesado", label: "Procesado" },
  { value: "archivado", label: "Archivado" },
];

export default function DocumentsPage() {
  // Inputs (form)
  const [form, setForm] = useState({
    buscar: "",
    nis: "",
    cliente: "",
    tipo: "",
    estado: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  // Query aplicado (lo que realmente consulta)
  const [query, setQuery] = useState({
    buscar: "",
    nis: "",
    cliente: "",
    tipo: "",
    estado: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  // UI
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Data
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  async function load() {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        ...removeEmpty(query),
      };

      const res = await documentApi.list(params);
      setDocumentos(res.data.documentos || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Error cargando documentos:", err);
      setDocumentos([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // Recarga cuando cambian page o query aplicado
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query]);

  function onSubmitSearch(e) {
    e.preventDefault();
    setPage(1);
    setQuery({ ...form });
  }

  function onChangeField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Cuando cambias filtros avanzados, refresca manteniendo búsqueda (criterio HU-08)
  function applyFilterInstant(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setPage(1);
    setQuery((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    const empty = {
      buscar: "",
      nis: "",
      cliente: "",
      tipo: "",
      estado: "",
      fecha_inicio: "",
      fecha_fin: "",
    };
    setForm(empty);
    setQuery(empty);
    setPage(1);
  }

  async function verDetalle(id) {
    try {
      const res = await documentApi.getById(id);
      alert(JSON.stringify(res.data.documento, null, 2));
    } catch (err) {
      console.error("Error detalle:", err);
    }
  }

  function exportCSV() {
    if (!documentos || documentos.length === 0) return;

    const headers = [
      "id",
      "nis",
      "cliente",
      "tipo_notificacion",
      "fecha_carta",
      "estado",
      "nombre_archivo",
    ];

    const rows = documentos.map((d) => [
      d.id ?? "",
      d.nis ?? "",
      d.cliente ?? "",
      d.tipo_notificacion ?? "",
      d.fecha_carta ?? "",
      labelEstado(mapEstadoUI(d.estado)) ?? "",
      d.nombre_archivo ?? "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `documentos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasActiveFilters = useMemo(() => {
    const q = removeEmpty(query);
    return Object.keys(q).length > 0;
  }, [query]);

  return (
    <div className="docs-page">
      <div className="docs-header">
        <div>
          <h1>Buscar y Filtrar Cartas</h1>
          <p>
            Utiliza la barra de búsqueda y los filtros para ubicar rápidamente
            los documentos.
          </p>
        </div>

        <div className="docs-header-actions">
          <button
            className="btn-secondary"
            onClick={() => setShowAdvanced((s) => !s)}
            type="button"
          >
            <SlidersHorizontal size={16} />
            Filtros avanzados
          </button>

          <button
            className="btn-secondary"
            onClick={exportCSV}
            type="button"
            disabled={documentos.length === 0}
            title={
              documentos.length === 0
                ? "No hay resultados para exportar"
                : "Exportar CSV"
            }
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Search bar */}
      <form className="docs-searchbar" onSubmit={onSubmitSearch}>
        <div className="search-input">
          <Search size={16} className="search-icon" />
          <input
            placeholder="Buscar por NIS, cliente, tipo, número de carta..."
            value={form.buscar}
            onChange={(e) => onChangeField("buscar", e.target.value)}
          />
          {form.buscar && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChangeField("buscar", "")}
              title="Limpiar búsqueda"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <button className="btn-primary" type="submit">
          <Search size={16} />
          Buscar
        </button>
      </form>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="docs-filters">
          <div className="filter-grid">
            <div className="filter-item">
              <label>NIS</label>
              <input
                value={form.nis}
                onChange={(e) => applyFilterInstant("nis", e.target.value)}
                placeholder="Ej: 1234567"
              />
            </div>

            <div className="filter-item">
              <label>Cliente</label>
              <input
                value={form.cliente}
                onChange={(e) =>
                  applyFilterInstant("cliente", e.target.value)
                }
                placeholder="Nombre del cliente"
              />
            </div>

            <div className="filter-item">
              <label>Tipo de carta</label>
              <input
                value={form.tipo}
                onChange={(e) => applyFilterInstant("tipo", e.target.value)}
                placeholder="Ej: Notificación / Reclamo..."
              />
            </div>

            <div className="filter-item">
              <label>Estado</label>
              <select
                value={form.estado}
                onChange={(e) => applyFilterInstant("estado", e.target.value)}
              >
                {ESTADOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>Fecha inicio</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) =>
                  applyFilterInstant("fecha_inicio", e.target.value)
                }
              />
            </div>

            <div className="filter-item">
              <label>Fecha fin</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) =>
                  applyFilterInstant("fecha_fin", e.target.value)
                }
              />
            </div>
          </div>

          <div className="filters-footer">
            {hasActiveFilters && (
              <button
                className="btn-danger-soft"
                type="button"
                onClick={clearFilters}
              >
                <X size={16} />
                Limpiar filtros
              </button>
            )}
            <span className="filters-note">Ordenados por fecha descendente</span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="docs-results">
        <div className="docs-results-head">
          <span className="results-title">Resultados</span>
          <span className="results-meta">
            {loading
              ? "Cargando..."
              : `${total} resultado${total !== 1 ? "s" : ""}`}
          </span>
        </div>

        {loading ? (
          <div className="docs-loading">
            <Loader size={18} className="spin" /> Cargando resultados...
          </div>
        ) : documentos.length === 0 ? (
          <div className="docs-empty">
            <h3>Sin resultados</h3>
            <p>No se encontraron documentos con esos criterios.</p>
            <button className="btn-secondary" type="button" onClick={clearFilters}>
              <X size={16} /> Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>NIS</th>
                  <th>Cliente</th>
                  <th>Tipo de Carta</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => {
                  const estadoUI = mapEstadoUI(doc.estado);
                  return (
                    <tr key={doc.id}>
                      <td className="mono">{doc.nis || "—"}</td>
                      <td>{doc.cliente || "Sin asignar"}</td>
                      <td>{doc.tipo_notificacion || "—"}</td>
                      <td className="mono">
                        {doc.fecha_carta ? formatDate(doc.fecha_carta) : "—"}
                      </td>
                      <td>
                        <span className={`badge st-${estadoUI}`}>
                          {labelEstado(estadoUI)}
                        </span>
                      </td>
                      <td className="col-actions">
                        <button
                          className="btn-link"
                          onClick={() => verDetalle(doc.id)}
                          type="button"
                        >
                          <Eye size={15} /> Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="docs-pagination">
              <button
                className="btn-secondary"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </button>

              <span className="page-info">
                Página <b>{page}</b> de <b>{totalPages}</b>
              </span>

              <button
                className="btn-secondary"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Helpers */
function removeEmpty(obj) {
  const clean = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") clean[k] = v;
  });
  return clean;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// BD -> UI
function mapEstadoUI(estado) {
  if (estado === "procesando") return "en_revision";
  if (estado === "validado") return "archivado";
  return estado || "";
}

function labelEstado(estadoUI) {
  const labels = {
    pendiente: "Pendiente",
    en_revision: "En revisión",
    procesado: "Procesado",
    archivado: "Archivado",
    error: "Error",
  };
  return labels[estadoUI] || estadoUI;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}