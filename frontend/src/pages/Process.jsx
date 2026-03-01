/**
 * Panel de Control - Procesamiento (HU-05 mejorada).
 *
 * Vista completa:
 *   - Resumen de estados (stats cards)
 *   - Expedientes pendientes con miniaturas de documentos
 *   - Preview de imagen, eliminar documento, mover entre expedientes
 *   - Procesamiento con SSE y progreso en tiempo real
 */

import { useState, useEffect, useRef } from "react";
import { documentApi, expedienteApi } from "../api/documents";
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader,
  Trash2,
  ArrowRightLeft,
  X,
  ZoomIn,
  FileText,
  FolderPlus,
} from "lucide-react";
import "../styles/process.css";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";

export default function ProcessPage() {
  const [summary, setSummary] = useState(null);
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Processing
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const eventSourceRef = useRef(null);

  // Modals
  const [previewImg, setPreviewImg] = useState(null);
  const [moveModal, setMoveModal] = useState(null); // { docId, docName, currentExpId }

  useEffect(() => {
    loadData();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statusRes, pendingRes] = await Promise.all([
        documentApi.getProcessStatus(),
        expedienteApi.listPending(),
      ]);
      setSummary(statusRes.data);
      setExpedientes(pendingRes.data.expedientes);

      // Verificar si hay un job activo (procesamiento en curso)
      const activeRes = await documentApi.getActiveJob();
      if (activeRes.data.job) {
        subscribeToJob(activeRes.data.job.id);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Delete document ──
  async function handleDelete(docId, docName) {
    if (!confirm(`¿Eliminar "${docName}"? Esta acción no se puede deshacer.`)) return;
    try {
      await expedienteApi.deleteDocument(docId);
      await loadData();
    } catch (err) {
      alert("Error al eliminar: " + (err.response?.data?.error || err.message));
    }
  }

  // ── Move document ──
  async function handleMove(targetExpId) {
    if (!moveModal) return;
    try {
      await expedienteApi.moveDocument(moveModal.docId, targetExpId);
      setMoveModal(null);
      await loadData();
    } catch (err) {
      alert("Error al mover: " + (err.response?.data?.error || err.message));
    }
  }

  async function handleMoveToNew() {
    if (!moveModal) return;
    try {
      const { data } = await expedienteApi.create();
      await expedienteApi.moveDocument(moveModal.docId, data.expediente.id);
      setMoveModal(null);
      await loadData();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  }

  // ── SSE Processing via Jobs ──
  function subscribeToJob(jobId) {
    // Limpiar conexión anterior si existe
    if (eventSourceRef.current) eventSourceRef.current.close();

    setProcessing(true);
    setResults([]);
    setFinalResult(null);
    setProgress({ current: 0, total: 0 });
    setActiveJobId(jobId);

    const token = localStorage.getItem("token");
    const es = new EventSource(`/api/procesar/job/${jobId}?token=${token}`);
    eventSourceRef.current = es;

    es.addEventListener("inicio", (e) => {
      const data = JSON.parse(e.data);
      setProgress((prev) => ({ ...prev, total: data.total }));
    });

    es.addEventListener("progreso", (e) => {
      const data = JSON.parse(e.data);
      setProgress({ current: data.current, total: data.total });
      setResults((prev) => {
        // Evitar duplicados en replay
        if (prev.some((r) => r.documento_id === data.documento_id)) return prev;
        return [...prev, data];
      });
    });

    es.addEventListener("completo", (e) => {
      const data = JSON.parse(e.data);
      setFinalResult(data);
      setProcessing(false);
      setActiveJobId(null);
      es.close();
      loadData();
    });

    es.onerror = () => {
      es.close();
      // No marcamos como terminado — el job sigue en el servidor
      // El usuario puede recargar y se reconectará
    };
  }

  async function startProcessing() {
    try {
      const { data } = await documentApi.startProcessing();
      subscribeToJob(data.job_id);
    } catch (err) {
      if (err.response?.status === 409) {
        // Ya hay un job activo, reconectarse
        subscribeToJob(err.response.data.job_id);
      } else {
        alert("Error al iniciar: " + (err.response?.data?.error || err.message));
      }
    }
  }

  function getImageUrl(doc) {
    return `${API_BASE}/${doc.ruta_archivo.replace(/\\/g, "/")}`;
  }

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const totalPendingDocs = expedientes.reduce(
    (sum, e) => sum + e.documentos.filter((d) => d.estado === "pendiente" || d.estado === "error").length,
    0
  );

  if (loading) {
    return (
      <div className="process-page">
        <div className="process-loading"><Loader size={18} className="spin" /> Cargando panel...</div>
      </div>
    );
  }

  return (
    <div className="process-page">
      {/* Header */}
      <div className="process-header">
        <div>
          <h1>Procesar Contenido</h1>
          <p>Revisa, organiza y procesa las cartas pendientes</p>
        </div>
        <button className="btn-icon" onClick={loadData} title="Actualizar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className="status-cards">
        <div className="status-card">
          <Clock size={18} className="sc-icon sc-pending" />
          <div>
            <span className="sc-value">{summary?.pendiente || 0}</span>
            <span className="sc-label">Pendientes</span>
          </div>
        </div>
        <div className="status-card">
          <CheckCircle2 size={18} className="sc-icon sc-success" />
          <div>
            <span className="sc-value">{summary?.procesado || 0}</span>
            <span className="sc-label">Procesados</span>
          </div>
        </div>
        <div className="status-card">
          <XCircle size={18} className="sc-icon sc-error" />
          <div>
            <span className="sc-value">{summary?.error || 0}</span>
            <span className="sc-label">Con error</span>
          </div>
        </div>
        <div className="status-card">
          <FileText size={18} className="sc-icon sc-total" />
          <div>
            <span className="sc-value">{summary?.total || 0}</span>
            <span className="sc-label">Total</span>
          </div>
        </div>
      </div>

      {/* Expedientes panel */}
      {!processing && !finalResult && (
        <>
          {expedientes.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={32} />
              <p>No hay documentos pendientes de procesamiento</p>
            </div>
          ) : (
            <div className="expedientes-panel">
              <div className="panel-header">
                <h2>Expedientes pendientes</h2>
                <span className="panel-badge">{expedientes.length} expediente{expedientes.length !== 1 && "s"} · {totalPendingDocs} documento{totalPendingDocs !== 1 && "s"}</span>
              </div>

              <div className="expedientes-list">
                {expedientes.map((exp) => (
                  <div key={exp.id} className="exp-card">
                    <div className="exp-header">
                      <div className="exp-title">
                        <span className="exp-id">Expediente #{exp.id}</span>
                        {exp.nis && (
                          <span className="exp-client">NIS {exp.nis} · {exp.cliente}</span>
                        )}
                      </div>
                      <span className="exp-date">
                        {new Date(exp.creado_en).toLocaleDateString("es-PE", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="exp-docs">
                      {exp.documentos.map((doc) => (
                        <div key={doc.id} className={`doc-card ${doc.estado}`}>
                          {/* Thumbnail */}
                          <div
                            className="doc-thumb"
                            onClick={() => setPreviewImg(getImageUrl(doc))}
                            title="Ver imagen completa"
                          >
                            <img
                              src={getImageUrl(doc)}
                              alt={doc.nombre_archivo}
                              loading="lazy"
                            />
                            <div className="thumb-overlay">
                              <ZoomIn size={16} />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="doc-info">
                            <span className="doc-name" title={doc.nombre_archivo}>
                              {doc.nombre_archivo}
                            </span>
                            <div className="doc-meta">
                              <span className={`doc-status st-${doc.estado}`}>
                                {doc.estado === "pendiente" && "Pendiente"}
                                {doc.estado === "error" && "Error"}
                                {doc.estado === "procesado" && "Procesado"}
                              </span>
                              {doc.anexo && <span className="doc-anexo">{doc.anexo}</span>}
                              <span className="doc-size">
                                {(doc.tamano_bytes / 1024).toFixed(0)} KB
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="doc-actions">
                            <button
                              className="doc-action-btn"
                              onClick={() =>
                                setMoveModal({
                                  docId: doc.id,
                                  docName: doc.nombre_archivo,
                                  currentExpId: exp.id,
                                })
                              }
                              title="Mover a otro expediente"
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                            <button
                              className="doc-action-btn doc-action-delete"
                              onClick={() => handleDelete(doc.id, doc.nombre_archivo)}
                              title="Eliminar documento"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Process button */}
              <div className="process-bar">
                <p className="process-bar-info">
                  Se procesarán <strong>{totalPendingDocs}</strong> documento{totalPendingDocs !== 1 && "s"} en <strong>{expedientes.length}</strong> expediente{expedientes.length !== 1 && "s"} con OCR + Gemini
                </p>
                <button
                  className="process-btn"
                  onClick={startProcessing}
                  disabled={totalPendingDocs === 0}
                >
                  <Play size={17} />
                  Procesar contenido
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Processing progress */}
      {processing && (
        <div className="progress-section">
          <div className="progress-header">
            <Loader size={16} className="spin" />
            <span>Procesando documento {progress.current} de {progress.total}...</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
          <span className="progress-pct">{pct}%</span>

          {results.length > 0 && (
            <div className="results-list">
              {results.map((r, i) => (
                <div key={i} className={`result-item ${r.estado === "procesado" ? "ri-success" : "ri-error"}`}>
                  {r.estado === "procesado" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span className="ri-name">{r.nombre_archivo}</span>
                  <span className="ri-badge">{r.estado === "procesado" ? "OK" : "Error"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Final result */}
      {finalResult && (
        <div className={`final-result ${finalResult.errores > 0 && finalResult.exitosos === 0 ? "fr-error" : finalResult.errores > 0 ? "fr-warning" : "fr-success"}`}>
          {finalResult.errores > 0 && finalResult.exitosos === 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <div>
            <p className="fr-message">{finalResult.mensaje}</p>
            {finalResult.total > 0 && (
              <p className="fr-detail">{finalResult.exitosos} extraidos, {finalResult.errores} con error</p>
            )}
          </div>
          <button className="fr-action" onClick={() => { setFinalResult(null); setResults([]); setActiveJobId(null); loadData(); }}>
            <RefreshCw size={14} /> Volver al panel
          </button>
        </div>
      )}

      {/* Image preview modal */}
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

      {/* Move document modal */}
      {moveModal && (
        <div className="modal-backdrop" onClick={() => setMoveModal(null)}>
          <div className="move-modal" onClick={(e) => e.stopPropagation()}>
            <div className="move-header">
              <h3>Mover documento</h3>
              <button className="modal-close" onClick={() => setMoveModal(null)}>
                <X size={16} />
              </button>
            </div>
            <p className="move-filename">{moveModal.docName}</p>
            <p className="move-subtitle">Selecciona el expediente destino:</p>

            <div className="move-list">
              {expedientes
                .filter((e) => e.id !== moveModal.currentExpId)
                .map((e) => (
                  <button
                    key={e.id}
                    className="move-option"
                    onClick={() => handleMove(e.id)}
                  >
                    <span className="move-exp-id">Exp. #{e.id}</span>
                    <span className="move-exp-info">
                      {e.nis ? `NIS ${e.nis} · ${e.cliente}` : "Sin cliente"} · {e.documentos.length} doc{e.documentos.length !== 1 && "s"}
                    </span>
                  </button>
                ))}
            </div>

            <button className="move-new-btn" onClick={handleMoveToNew}>
              <FolderPlus size={15} />
              Crear nuevo expediente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
