/**
 * Expedientes procesados (HU-06) + Validación de datos (HU-07).
 *
 * VISTA TABLA: Lista de expedientes con filtros y paginación.
 *
 * VISTA DETALLE + VALIDACIÓN:
 *   - Hero: Datos del cliente + resumen de extracción
 *   - Tabs por Anexo
 *   - Split: Imagen IZQUIERDA (referencia) | Formulario DERECHA (editable)
 *   - Botones: Guardar Correcciones, Validar, Marcar como pendiente
 *   - Campos bloqueados cuando estado = validado
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { expedienteApi } from "../api/documents";
import { servicioApi } from "../api/prepararServicio";
import CargarModal from "../components/CargarModal";
import ServicioDrawer from "../components/ServicioDrawer";
import {
  Search, X, ChevronLeft, ChevronRight, FileText, Upload, Download,
  Loader, Eye, EyeOff, ZoomIn, FolderOpen,
  CheckCircle, RotateCcw, Lock, AlertCircle, Pencil,
  Camera, ArrowRight,
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

const CAMPOS_OBLIGATORIOS = ["numero_carta", "fecha_carta", "anexo", "numero_acta"];

export default function ExpedientesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── List state ──
  const [expedientes, setExpedientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaInput, setBusquedaInput] = useState("");

  // ── Detail state ──
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [previewImg, setPreviewImg] = useState(null);

  // ── HU-07: Edit state ──
  const [editForm, setEditForm] = useState({});
  const [paramEdits, setParamEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [toast, setToast] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hideConfirm, setHideConfirm] = useState(null);
  const [showCargarModal, setShowCargarModal] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [showServicioDrawer, setShowServicioDrawer] = useState(false);

  const LIMIT = 15;

  useEffect(() => { loadExpedientes(); }, [page, filtroEstado, busqueda]);

  useEffect(() => {
    const openId = searchParams.get("open");
    if (openId && !detail) {
      openDetail(parseInt(openId));
      searchParams.delete("open");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  // Populate edit form when active document changes
  useEffect(() => {
    if (detail) {
      const doc = (detail.documentos || [])[activeDocIndex];
      if (doc) {
        populateForm(doc);
      }
    }
  }, [detail, activeDocIndex]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function populateForm(doc) {
    setEditForm({
      numero_carta: doc.numero_carta || "",
      fecha_carta: doc.fecha_carta ? doc.fecha_carta.split("T")[0] : "",
      anexo: doc.anexo || "",
      numero_acta: doc.numero_acta || "",
      fecha_muestra: doc.fecha_muestra ? doc.fecha_muestra.split("T")[0] : "",
      numero_informe: doc.numero_informe || "",
    });
    // Populate param edits
    const pe = {};
    for (const p of (doc.parametros_vma || [])) {
      pe[p.resultado_id] = p.resultado_valor || "";
    }
    setParamEdits(pe);
    setFieldErrors({});
  }

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

  async function reloadDetail() {
    if (!detail) return;
    try {
      const { data } = await expedienteApi.getDetail(detail.id);
      setDetail(data.expediente);
    } catch (err) {
      console.error("Error recargando detalle:", err);
    }
  }

  function closeDetail() {
    setDetail(null);
    setActiveDocIndex(0);
    setToast(null);
    setFieldErrors({});
    loadExpedientes(); // Refresh list
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
    setBusqueda(busquedaInput.trim());
  }

  function handleFilterChange(estado) { setFiltroEstado(estado); setPage(1); }

  function handleHide(expId, nis) {
    setHideConfirm({ id: expId, nis: nis || "N/A" });
  }

  async function confirmHide() {
    if (!hideConfirm) return;
    try {
      await expedienteApi.hideExpediente(hideConfirm.id);
      setHideConfirm(null);
      setToast({ type: "success", message: `Expediente #${hideConfirm.id} ocultado correctamente` });
      loadExpedientes();
    } catch (err) {
      const msg = err.response?.data?.error || "Error al ocultar el expediente";
      setToast({ type: "error", message: msg });
      setHideConfirm(null);
    }
  }

  async function handleDownloadDoc(tipo) {
    if (!detail) return;
    setDownloading(tipo);
    try {
      const response = tipo === "proforma"
        ? await servicioApi.generarProforma(detail.id)
        : await servicioApi.generarProgramacion(detail.id);

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}_${detail.nis || detail.id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.error || `Error al generar ${tipo}` });
    } finally {
      setDownloading(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-PE", {
      day: "2-digit", month: "short", year: "numeric",
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

  function updateField(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function updateParam(resultadoId, value) {
    setParamEdits((prev) => ({ ...prev, [resultadoId]: value }));
  }

  function validateFields() {
    const errors = {};
    for (const field of CAMPOS_OBLIGATORIOS) {
      if (!editForm[field] || String(editForm[field]).trim() === "") {
        errors[field] = true;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── HU-07: Actions ──

  async function handleSave() {
    if (!validateFields()) {
      setToast({ type: "error", message: "Verifique los datos obligatorios" });
      return;
    }
    const doc = (detail.documentos || [])[activeDocIndex];
    if (!doc) return;

    setSaving(true);
    try {
      const parametros = Object.entries(paramEdits).map(([resultado_id, resultado_valor]) => ({
        resultado_id: parseInt(resultado_id),
        resultado_valor,
      }));
      await expedienteApi.updateDocFields(doc.id, editForm, parametros);
      await reloadDetail();
      setToast({ type: "success", message: "Correcciones guardadas" });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al guardar";
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!validateFields()) {
      setToast({ type: "error", message: "Verifique los datos obligatorios" });
      return;
    }
    const doc = (detail.documentos || [])[activeDocIndex];
    if (!doc) return;

    setValidating(true);
    try {
      // Save first, then validate
      const parametros = Object.entries(paramEdits).map(([resultado_id, resultado_valor]) => ({
        resultado_id: parseInt(resultado_id),
        resultado_valor,
      }));
      await expedienteApi.updateDocFields(doc.id, editForm, parametros);
      const { data } = await expedienteApi.validateDoc(doc.id);
      await reloadDetail();
    } catch (err) {
      const msg = err.response?.data?.error || "Error al validar";
      setToast({ type: "error", message: msg });
    } finally {
      setValidating(false);
    }
  }

  async function handleMarkPending() {
    const doc = (detail.documentos || [])[activeDocIndex];
    if (!doc) return;

    try {
      await expedienteApi.markPending(doc.id);
      await reloadDetail();
    } catch (err) {
      const msg = err.response?.data?.error || "Error al marcar como pendiente";
      setToast({ type: "error", message: msg });
    }
  }

  // ══════════════════════════════════════════
  //  VISTA DETALLE + VALIDACIÓN (HU-07)
  // ══════════════════════════════════════════
  if (detail) {
    const docs = detail.documentos || [];
    const activeDoc = docs[activeDocIndex] || null;
    const isLocked = activeDoc?.estado === "validado";

    return (
      <div className="exp-page exp-page-wide">

        <button className="det-back" onClick={closeDetail}>
          <ChevronLeft size={16} /> Volver a expedientes
        </button>

        {/* ── HERO ── */}
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

          <div className="hero-workflow">
            <span className="workflow-label">Progreso del expediente</span>
            <div className="wf-checklist">
              <div className={`wf-check-item ${detail.estado !== "procesado" && detail.estado !== "en_revision" ? "wf-item-done" : "wf-item-active"}`}>
                <div className="wf-check-dot">
                  {detail.estado !== "procesado" && detail.estado !== "en_revision" ? <CheckCircle size={15} /> : <span className="wf-num">1</span>}
                </div>
                <span>Validacion de datos</span>
              </div>
              {["completo", "servicio_programado", "evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado) ? (
                <div onClick={() => setShowServicioDrawer(true)} className={`wf-check-item wf-check-link ${detail.precio_servicio && detail.fecha_programacion ? "wf-item-done" : "wf-item-pending"}`}>
                  <div className="wf-check-dot">
                    {detail.precio_servicio && detail.fecha_programacion ? <CheckCircle size={15} /> : <span className="wf-num">2</span>}
                  </div>
                  <span>Preparar servicio</span>
                  {detail.precio_servicio && (
                    <span className="wf-check-meta">S/.{detail.precio_servicio} <Pencil size={11} /></span>
                  )}
                </div>
              ) : (
                <div className="wf-check-item wf-item-locked">
                  <div className="wf-check-dot"><span className="wf-num">2</span></div>
                  <span>Preparar servicio</span>
                </div>
              )}
              {["completo", "servicio_programado", "evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado) ? (
                <Link to={`/expedientes/${detail.id}/evidencias`} className={`wf-check-item wf-check-link ${["evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado) ? "wf-item-done" : "wf-item-pending"}`}>
                  <div className="wf-check-dot">
                    {["evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado) ? <CheckCircle size={15} /> : <span className="wf-num">3</span>}
                  </div>
                  <span>Completar evidencias</span>
                </Link>
              ) : (
                <div className="wf-check-item wf-item-locked">
                  <div className="wf-check-dot"><span className="wf-num">3</span></div>
                  <span>Completar evidencias</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hub de Documentos */}
        {!["procesado", "en_revision"].includes(detail.estado) && (
          <div className="doc-hub">
            <div className="doc-hub-header">
              <span className="doc-hub-title">Documentos generados</span>
            </div>

            <div className="doc-hub-group">
              <span className="doc-hub-group-label">Servicio</span>
              <div className="doc-hub-grid">
                <DocItem name="Proforma" ready={!!detail.precio_servicio} step="2"
                  loading={downloading === "proforma"} onDownload={() => handleDownloadDoc("proforma")} />
                <DocItem name="Carta de Programacion" ready={!!detail.fecha_programacion} step="2"
                  loading={downloading === "programacion"} onDownload={() => handleDownloadDoc("programacion")} />
              </div>
            </div>

            <div className="doc-hub-group">
              <span className="doc-hub-group-label">Expediente final</span>
              <div className="doc-hub-grid">
                {["Certificado", "Informe Tecnico", "Levantamiento", "Ficha Tecnica", "Reporte Fotografico Inoculacion", "Reporte Fotografico Monitoreo"].map((name) => (
                  <DocItem key={name} name={name}
                    ready={["evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado)}
                    step="3" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TABS SIMPLIFICADOS EN JSX ── */}
        {docs.length > 0 && (
          <div className="det-tabs">
            {docs.map((doc, i) => (
              <button key={doc.id}
                className={`det-tab ${i === activeDocIndex ? "active" : ""}`}
                onClick={() => setActiveDocIndex(i)}
              >
                <span className="tab-name">{doc.anexo || `Documento ${i + 1}`}</span>
                {doc.estado === "validado" ? (
                  <CheckCircle size={14} className="tab-icon-validado" />
                ) : (
                  <AlertCircle size={14} className="tab-icon-pendiente" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── ACTION BAR (HU-07) ── */}
        {activeDoc && (
          <div className={`action-bar ${isLocked ? "locked" : ""}`}>
            {isLocked ? (
              <>
                <div className="action-bar-status">
                  <Lock size={14} />
                  <span>Documento validado</span>
                </div>
                <div className="action-bar-buttons">
                  {(() => {
                    const hasService = detail.precio_servicio && detail.fecha_programacion;
                    const hasEvidencias = ["evidencias_cargadas", "listo_para_generar", "generado"].includes(detail.estado);
                    if (["completo", "servicio_programado"].includes(detail.estado) && !hasService) return (
                      <button className="btn btn-primary" onClick={() => setShowServicioDrawer(true)}>
                        Continuar a Servicio <ArrowRight size={14} />
                      </button>
                    );
                    if (["completo", "servicio_programado"].includes(detail.estado) && hasService && !hasEvidencias) return (
                      <Link to={`/expedientes/${detail.id}/evidencias`} className="btn btn-primary">
                        Continuar a Evidencias <ArrowRight size={14} />
                      </Link>
                    );
                    return null;
                  })()}
                  <button className="btn btn-outline btn-sm" onClick={handleMarkPending}>
                    <RotateCcw size={14} /> Desbloquear
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="action-bar-status">
                  <AlertCircle size={14} />
                  <span>Pendiente de validacion</span>
                </div>
                <button className="btn btn-primary" onClick={handleValidate} disabled={validating}>
                  {validating ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
                  Validar registro
                </button>
              </>
            )}
          </div>
        )}

        {/* ── TOAST ── */}
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
          </div>
        )}

        {/* ── SPLIT: Image LEFT + Form RIGHT (HU-07 layout) ── */}
        {activeDoc ? (
          <div className="det-split-v2 split-reversed">
            {/* LEFT: Image */}
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

            {/* RIGHT: Editable form */}
            <div className="det-data-col">
              {/* Carta fields */}
              <div className={`card card-accent-blue ${isLocked ? "card-locked" : ""}`}>
                <div className="card-header">
                  <span className="card-title">Datos de la carta</span>
                  <div className="card-header-right">
                    <span className={`badge st-${activeDoc.estado}`}>{activeDoc.estado}</span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="fields-grid-3">
                    <EditField label="Nº Carta" field="numero_carta" type="text"
                      value={editForm.numero_carta} onChange={updateField}
                      locked={isLocked} required error={fieldErrors.numero_carta} />
                    <EditField label="Fecha carta" field="fecha_carta" type="date"
                      value={editForm.fecha_carta} onChange={updateField}
                      locked={isLocked} required error={fieldErrors.fecha_carta} />
                    <EditField label="Anexo" field="anexo" type="select"
                      value={editForm.anexo} onChange={updateField}
                      locked={isLocked} required error={fieldErrors.anexo}
                      options={[
                        { value: "", label: "Seleccionar..." },
                        { value: "Anexo 1", label: "Anexo 1" },
                        { value: "Anexo 2", label: "Anexo 2" },
                      ]} />
                    <EditField label="Nº Acta" field="numero_acta" type="text"
                      value={editForm.numero_acta} onChange={updateField}
                      locked={isLocked} required error={fieldErrors.numero_acta} />
                    <EditField label="Fecha muestra" field="fecha_muestra" type="date"
                      value={editForm.fecha_muestra} onChange={updateField}
                      locked={isLocked} />
                    <EditField label="Nº Informe" field="numero_informe" type="text"
                      value={editForm.numero_informe} onChange={updateField}
                      locked={isLocked} />
                  </div>
                </div>
              </div>

              {/* VMA Parameters */}
              {activeDoc.parametros_vma?.length > 0 && (
                <div className={`card card-accent-purple ${isLocked ? "card-locked" : ""}`}>
                  <div className="card-header">
                    <span className="card-title">Parámetros VMA</span>
                    <span className="card-subtitle">
                      {activeDoc.parametros_vma.length} parámetros
                    </span>
                  </div>
                  <div className="card-body no-pad">
                    <table className="vma-table">
                      <thead>
                        <tr>
                          <th className="col-code">Cod.</th>
                          <th>Parametro</th>
                          <th className="col-num">Valor</th>
                          <th className="col-num">VMA ref.</th>
                          <th className="col-unit">Und.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDoc.parametros_vma.map((p) => {
                          const val = paramEdits[p.resultado_id] ?? p.resultado_valor ?? "";
                          return (
                            <tr key={p.resultado_id}>
                              <td className="cell-code">{p.codigo}</td>
                              <td className="cell-param">{p.nombre_completo}</td>
                              <td className="cell-result">
                                {isLocked ? (
                                  <span>{val || "\u2014"}</span>
                                ) : (
                                  <input
                                    type="text"
                                    className="param-input"
                                    value={val}
                                    onChange={(e) => updateParam(p.resultado_id, e.target.value)}
                                  />
                                )}
                              </td>
                              <td className="cell-vma">{p.vma_normado ?? "\u2014"}</td>
                              <td className="cell-unit">{p.unidad}</td>
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

        <ServicioDrawer
          open={showServicioDrawer}
          expedienteId={detail.id}
          currentPrecio={detail.precio_servicio}
          currentFecha={detail.fecha_programacion}
          onClose={() => setShowServicioDrawer(false)}
          onSaved={() => {
            setShowServicioDrawer(false);
            reloadDetail();
          }}
        />
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
          <h1>Expedientes</h1>
          <p>Carga, procesa y valida los expedientes del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCargarModal(true)}>
          <Upload size={16} /> Cargar cartas
        </button>
      </div>

      <CargarModal
        open={showCargarModal}
        onClose={() => setShowCargarModal(false)}
        onComplete={(expId) => {
          setShowCargarModal(false);
          loadExpedientes();
          if (expId) openDetail(expId);
        }}
      />

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
          <input type="text" placeholder="Buscar por N° expediente, NIS o cliente..."
            value={busquedaInput} onChange={(e) => setBusquedaInput(e.target.value)} />
          {busqueda && (
            <button type="button" className="search-clear"
              onClick={() => { setBusquedaInput(""); setBusqueda(""); setPage(1); }}>
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      <div className="exp-meta"><span>{total} expediente{total !== 1 && "s"}</span></div>

      {loading ? (
        <div className="exp-loading"><Loader size={18} className="spin" /> Cargando expedientes...</div>
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
                <th>N° Exp.</th><th>NIS</th><th>Cliente</th><th>Fecha</th><th>Anexos</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {expedientes.map((exp) => {
                const est = getEstadoLabel(exp);
                return (
                  <tr key={exp.id} className="exp-row" onClick={() => openDetail(exp.id)}>
                    <td className="td-exp-id">{exp.id}</td>
                    <td className="td-nis">{exp.nis || "—"}</td>
                    <td className="td-cliente">{exp.cliente || "Sin asignar"}</td>
                    <td className="td-date">{formatDate(exp.fecha_mas_reciente || exp.creado_en)}</td>
                    <td className="td-anexos">
                      {exp.anexos?.length > 0 ? exp.anexos.map((a) => (<span key={a} className={`badge-anexo ${a === "Anexo 1" ? "anexo-1" : "anexo-2"}`}>{a.replace("Anexo ", "")}</span>)) : "—"}
                    </td>
                    <td><span className={`badge st-${est}`}>{est}</span></td>
                    <td className="td-actions">
                      <button className="action-icon" title="Ver detalle" onClick={(e) => { e.stopPropagation(); openDetail(exp.id); }}>
                        <Eye size={15} />
                      </button>
                      <button className="action-icon action-hide" title="Ocultar expediente"
                        onClick={(e) => { e.stopPropagation(); handleHide(exp.id, exp.nis); }}>
                        <EyeOff size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="exp-pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /> Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente <ChevronRight size={16} /></button>
        </div>
      )}

      {detailLoading && (
        <div className="loading-overlay"><Loader size={20} className="spin" /> Cargando expediente...</div>
      )}

      {hideConfirm && (
        <div className="modal-backdrop" onClick={() => setHideConfirm(null)}>
          <div className="hide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hide-modal-icon">
              <EyeOff size={24} />
            </div>
            <h3 className="hide-modal-title">Ocultar expediente</h3>
            <p className="hide-modal-text">
              El expediente <strong>#{hideConfirm.id}</strong>
              {hideConfirm.nis !== "N/A" && <> (NIS: {hideConfirm.nis})</>} dejara
              de ser visible en la lista. Podra ser restaurado por un administrador.
            </p>
            <div className="hide-modal-actions">
              <button className="btn btn-outline" onClick={() => setHideConfirm(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmHide}>Ocultar expediente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
//  Components
// ══════════════════════════════════════════

function DocItem({ name, ready, step, loading, onDownload }) {
  return (
    <div className={`doc-hub-item ${ready ? "doc-ready" : "doc-pending"}`}>
      <FileText size={15} className="doc-hub-icon" />
      <span className="doc-hub-name">{name}</span>
      {ready && onDownload ? (
        <>
          <span className="doc-hub-badge doc-badge-ready">Listo</span>
          <button className="doc-hub-dl" onClick={onDownload} disabled={loading}>
            {loading ? <Loader size={13} className="spin" /> : <Download size={13} />}
          </button>
        </>
      ) : (
        <span className="doc-hub-badge doc-badge-pending">Paso {step}</span>
      )}
    </div>
  );
}

function EditField({ label, field, type, value, onChange, locked, required, error, options }) {
  const labelText = `${label}${required ? " *" : ""}`;

  if (locked) {
    return (
      <div className="fv2">
        <span className="fv2-label">{labelText}</span>
        <span className="fv2-value fv2-highlight">{value || "—"}</span>
      </div>
    );
  }

  return (
    <div className={`edit-field ${error ? "edit-field-error" : ""}`}>
      <label className="edit-label">{labelText}</label>
      {type === "select" ? (
        <select className="edit-input" value={value || ""}
          onChange={(e) => onChange(field, e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type} className="edit-input"
          value={value || ""} onChange={(e) => onChange(field, e.target.value)}
        />
      )}
      {error && <span className="edit-error-msg">Campo obligatorio</span>}
    </div>
  );
}

// ══════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════
