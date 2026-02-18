/**
 * Ver expedientes procesados (HU-06).
 *
 * Propósito: Verificar que los datos extraídos por OCR sean correctos.
 * Los colores rojo/verde en parámetros son ayuda visual para el operador,
 * NO representan un juicio de cumplimiento (eso ya viene de origen).
 */

import { useState, useEffect } from "react";
import { expedienteApi } from "../api/documents";
import {
  Search, X, ChevronLeft, ChevronRight, FileText,
  Loader, Eye, ZoomIn, FolderOpen, Files,
} from "lucide-react";
import "../styles/expedientes.css";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";

const FILTROS = [
  { value: "", label: "Todos" },
  { value: "procesado", label: "Procesados" },
  { value: "completo", label: "Completos" },
  { value: "en_revision", label: "En revisión" },
  { value: "pendiente", label: "Pendientes" },
];

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaInput, setBusquedaInput] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [previewImg, setPreviewImg] = useState(null);

  const LIMIT = 15;

  useEffect(() => { loadExpedientes(); }, [page, filtroEstado, busqueda]);

  async function loadExpedientes() {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filtroEstado) params.estado = filtroEstado;
      if (busqueda) params.buscar = busqueda;
      const { data } = await expedienteApi.listProcessed(params);
      setExpedientes(data.expedientes);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Error cargando expedientes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(expId) {
    setDetailLoading(true);
    try {
      const { data } = await expedienteApi.getDetail(expId);
      setDetail(data.expediente);
      setActiveDocIndex(0);
    } catch (err) {
      console.error("Error cargando detalle:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() { setDetail(null); setActiveDocIndex(0); }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setBusqueda(busquedaInput.trim());
  }

  function handleFilterChange(estado) { setFiltroEstado(estado); setPage(1); }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  function formatDateLong(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit", month: "long", year: "numeric",
    });
  }

  function getEstadoLabel(exp) {
    if (exp.errores > 0) return "error";
    if (exp.validados === exp.num_documentos && exp.num_documentos > 0) return "validado";
    if (exp.procesados > 0) return "procesado";
    return exp.estado || "pendiente";
  }

  function getImageUrl(doc) {
    return `${API_BASE}/${doc.ruta_archivo.replace(/\\/g, "/")}`;
  }

  // ══════════════════════════════════════════
  //  VISTA DETALLE
  // ══════════════════════════════════════════
  if (detail) {
    const docs = detail.documentos || [];
    const activeDoc = docs[activeDocIndex] || null;
    const extraction = getExtractionSummary(docs);

    return (
      <div className="exp-page exp-page-wide">

        <button className="det-back" onClick={closeDetail}>
          <ChevronLeft size={16} /> Volver a expedientes
        </button>

        {/* ── HERO: Client + Extraction summary ── */}
        <div className="hero-grid">
          <div className="hero-client">
            <div className="hero-client-top">
              <div>
                <div className="hero-meta">
                  <span className="hero-exp-id">Expediente #{detail.id}</span>
                  <span className="hero-docs-badge">
                    {docs.length} documento{docs.length !== 1 && "s"}
                  </span>
                </div>
                <h1 className="hero-name">{detail.cliente || "Cliente sin asignar"}</h1>
              </div>
              <span className={`status-badge st-${detail.estado}`}>{detail.estado}</span>
            </div>
            <div className="hero-fields">
              <div className="hf-card">
                <span className="hf-label">NIS</span>
                <span className="hf-value mono">{detail.nis || "—"}</span>
              </div>
              <div className="hf-card">
                <span className="hf-label">NIA</span>
                <span className="hf-value mono">{detail.nia || "—"}</span>
              </div>
              <div className="hf-card">
                <span className="hf-label">Distrito</span>
                <span className="hf-value">{detail.distrito || "—"}</span>
              </div>
              <div className="hf-card hf-span2">
                <span className="hf-label">Dirección</span>
                <span className="hf-value">{detail.direccion || "—"}</span>
              </div>
            </div>
          </div>

          {/* Extraction summary */}
          <div className="hero-extraction">
            <span className="extraction-label">Resumen de extracción</span>
            <div className="extraction-number-row">
              <span className="extraction-number">{extraction.totalParams}</span>
              <span className="extraction-text">parámetros extraídos</span>
            </div>
            <div className="extraction-bar">
              <div
                className="extraction-bar-fill"
                style={{ width: `${extraction.camposTotales > 0 ? (extraction.camposExtraidos / extraction.camposTotales) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="extraction-details">
              <span className="ext-detail-value">
                {extraction.camposExtraidos} de {extraction.camposTotales} campos completados
              </span>
            </div>
            <div className="extraction-counters">
              <div className="ext-counter red">
                <span className="ext-counter-num">{extraction.excedidos}</span>
                <span className="ext-counter-label">superan VMA</span>
              </div>
              <div className="ext-counter green">
                <span className="ext-counter-num">{extraction.conformes}</span>
                <span className="ext-counter-label">dentro de VMA</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        {docs.length > 0 && (
          <div className="det-tabs">
            {docs.map((doc, i) => {
              const paramCount = (doc.parametros_vma || []).length;
              const excCount = (doc.parametros_vma || [])
                .filter((p) => checkExcede(p.resultado_valor, p.vma_normado)).length;
              return (
                <button
                  key={doc.id}
                  className={`det-tab ${i === activeDocIndex ? "active" : ""}`}
                  onClick={() => setActiveDocIndex(i)}
                >
                  <span className="tab-name">{doc.anexo || `Documento ${i + 1}`}</span>
                  <span className="tab-info">
                    {paramCount > 0 ? `${paramCount} parám.` : "Sin parámetros"}
                  </span>
                  {excCount > 0 && (
                    <span className="tab-count red">{excCount}</span>
                  )}
                  <span className={`tab-badge st-${doc.estado}`}>{doc.estado}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── SPLIT: Data (left) + Image (right) ── */}
        {activeDoc ? (
          <div className="det-split-v2">
            <div className="det-data-col">
              {/* Carta fields */}
              <div className="card card-accent-blue">
                <div className="card-header">
                  <span className="card-title">Datos de la carta</span>
                  <div className="card-header-right">
                    <span className={`badge st-${activeDoc.estado}`}>{activeDoc.estado}</span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="fields-grid-3">
                    <FieldV2 label="Nº Carta" value={activeDoc.numero_carta} highlight />
                    <FieldV2 label="Fecha carta" value={formatDateLong(activeDoc.fecha_carta)} />
                    <FieldV2 label="Anexo" value={activeDoc.anexo} />
                    <FieldV2 label="Nº Acta de toma de muestra" value={activeDoc.numero_acta} />
                    <FieldV2 label="Fecha de muestra" value={formatDateLong(activeDoc.fecha_muestra)} />
                    <FieldV2 label="Nº Informe de ensayo" value={activeDoc.numero_informe} />
                  </div>
                </div>
              </div>

              {/* VMA Parameters */}
              {activeDoc.parametros_vma?.length > 0 && (
                <div className="card card-accent-purple">
                  <div className="card-header">
                    <span className="card-title">Parámetros VMA extraídos</span>
                    <span className="card-subtitle">
                      {activeDoc.parametros_vma.length} parámetros
                    </span>
                  </div>
                  <div className="card-body no-pad">
                    <table className="vma-table">
                      <thead>
                        <tr>
                          <th className="col-code">Cód.</th>
                          <th>Parámetro</th>
                          <th className="col-num">Valor extraído</th>
                          <th className="col-num">VMA ref.</th>
                          <th className="col-unit">Unidad</th>
                          <th className="col-status">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDoc.parametros_vma.map((p, i) => {
                          const excede = checkExcede(p.resultado_valor, p.vma_normado);
                          return (
                            <tr key={i} className={excede ? "row-exceed" : "row-ok"}>
                              <td className="cell-code">{p.codigo}</td>
                              <td className="cell-param">{p.nombre_completo}</td>
                              <td className={`cell-result ${excede ? "val-exceed" : "val-ok"}`}>
                                {p.resultado_valor != null ? p.resultado_valor : (
                                  <span className="val-empty">sin dato</span>
                                )}
                              </td>
                              <td className="cell-vma">{p.vma_normado ?? "—"}</td>
                              <td className="cell-unit">{p.unidad}</td>
                              <td className="cell-status">
                                {p.resultado_valor != null ? (
                                  <span className={`vma-pill ${excede ? "pill-exceed" : "pill-ok"}`}>
                                    {excede ? "Supera" : "Dentro"}
                                  </span>
                                ) : (
                                  <span className="vma-pill pill-empty">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(!activeDoc.parametros_vma || activeDoc.parametros_vma.length === 0) &&
                activeDoc.estado === "procesado" && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Parámetros VMA</span>
                  </div>
                  <div className="params-empty">
                    No se extrajeron parámetros para este documento.
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Image */}
            <div className="det-img-col">
              <div className="img-card">
                <div className="img-card-header">Documento original</div>
                <div className="img-frame" onClick={() => setPreviewImg(getImageUrl(activeDoc))}>
                  <img src={getImageUrl(activeDoc)} alt={activeDoc.nombre_archivo} />
                  <div className="img-hover-overlay">
                    <ZoomIn size={16} /> <span>Ampliar</span>
                  </div>
                </div>
              </div>
              <div className="img-meta">
                <span className="img-filename">{activeDoc.nombre_archivo}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="det-empty">
            <FileText size={28} />
            <p>Este expediente no tiene documentos.</p>
          </div>
        )}

        {/* Zoom modal */}
        {previewImg && (
          <div className="modal-backdrop" onClick={() => setPreviewImg(null)}>
            <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setPreviewImg(null)}>
                <X size={18} />
              </button>
              <img src={previewImg} alt="Vista previa" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  VISTA TABLA
  // ══════════════════════════════════════════
  return (
    <div className="exp-page">
      <div className="exp-header">
        <div>
          <h1>Expedientes procesados</h1>
          <p>Revisa los datos extraídos de cada expediente y verifica que sean correctos</p>
        </div>
      </div>

      <div className="exp-filters">
        <div className="filter-tabs">
          {FILTROS.map((f) => (
            <button key={f.value}
              className={`filter-tab ${filtroEstado === f.value ? "active" : ""}`}
              onClick={() => handleFilterChange(f.value)}>{f.label}</button>
          ))}
        </div>
        <form className="filter-search" onSubmit={handleSearch}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Buscar por NIS o cliente..."
            value={busquedaInput} onChange={(e) => setBusquedaInput(e.target.value)} />
          {busqueda && (
            <button type="button" className="search-clear"
              onClick={() => { setBusquedaInput(""); setBusqueda(""); setPage(1); }}>
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      <div className="exp-meta">
        <span>{total} expediente{total !== 1 && "s"}</span>
      </div>

      {loading ? (
        <div className="exp-loading">
          <Loader size={18} className="spin" /> Cargando expedientes...
        </div>
      ) : expedientes.length === 0 ? (
        <div className="exp-empty">
          <FolderOpen size={32} />
          <p>No se encontraron expedientes{filtroEstado && ` con estado "${filtroEstado}"`}</p>
        </div>
      ) : (
        <div className="exp-table-wrapper">
          <table className="exp-table">
            <thead>
              <tr>
                <th>NIS</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Documentos</th>
                <th>Anexos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expedientes.map((exp) => {
                const est = getEstadoLabel(exp);
                return (
                  <tr key={exp.id} className="exp-row" onClick={() => openDetail(exp.id)}>
                    <td className="td-nis">{exp.nis || "—"}</td>
                    <td className="td-cliente">{exp.cliente || "Sin asignar"}</td>
                    <td className="td-date">{formatDate(exp.fecha_mas_reciente || exp.creado_en)}</td>
                    <td>
                      <span className="docs-count"><Files size={13} /> {exp.num_documentos}</span>
                    </td>
                    <td className="td-anexos">
                      {exp.anexos?.length > 0
                        ? exp.anexos.map((a) => (<span key={a} className="badge-anexo">{a}</span>))
                        : "—"}
                    </td>
                    <td><span className={`badge st-${est}`}>{est}</span></td>
                    <td className="td-action"><Eye size={15} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="exp-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={16} /> Anterior
          </button>
          <span>Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}

      {detailLoading && (
        <div className="loading-overlay">
          <Loader size={20} className="spin" /> Cargando expediente...
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function FieldV2({ label, value, highlight = false }) {
  return (
    <div className="fv2">
      <span className="fv2-label">{label}</span>
      <span className={`fv2-value ${highlight ? "fv2-highlight" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function checkExcede(resultado, vma) {
  if (resultado == null || !vma) return false;
  const val = parseFloat(resultado);
  if (isNaN(val)) return false;
  if (String(vma).includes("-")) {
    const [min, max] = String(vma).split("-").map(Number);
    return val < min || val > max;
  }
  return val > parseFloat(vma);
}

function getExtractionSummary(documentos) {
  const camposBase = ["numero_carta", "fecha_carta", "numero_acta", "fecha_muestra", "numero_informe"];
  let camposExtraidos = 0;
  let camposTotales = 0;
  let totalParams = 0;
  let excedidos = 0;
  let conformes = 0;

  for (const doc of documentos) {
    camposTotales += camposBase.length;
    camposExtraidos += camposBase.filter((c) => doc[c]).length;
    for (const p of (doc.parametros_vma || [])) {
      totalParams++;
      if (checkExcede(p.resultado_valor, p.vma_normado)) {
        excedidos++;
      } else if (p.resultado_valor != null) {
        conformes++;
      }
    }
  }

  return { totalParams, camposExtraidos, camposTotales, excedidos, conformes };
}
