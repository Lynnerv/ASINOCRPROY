/**
 * Completar Evidencias del Expediente (HU-11).
 *
 * Features:
 *   - Multi-upload de fotos (drop varios archivos a la vez)
 *   - Drag & drop para reordenar fotos
 *   - PDF del informe de laboratorio
 *   - N° de factura con prefijo E001- pre-rellenado
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Upload, X, CheckCircle, AlertCircle, Loader,
  Camera, FileText, Receipt, Image as ImageIcon, Save, GripVertical,
} from "lucide-react";
import { expedienteApi } from "../api/documents";
import { evidenciasApi } from "../api/evidencias";
import "../styles/evidencias.css";

const API_BASE =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";

const FACTURA_PREFIX = "E001-";
const FACTURA_REGEX = /^E001-\d{2,}$/;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS = 4;

export default function CompletarEvidencias() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [expediente, setExpediente] = useState(null);
  const [evidencias, setEvidencias] = useState([]);
  const [numeroFactura, setNumeroFactura] = useState(FACTURA_PREFIX);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: detailData } = await expedienteApi.getDetail(id);
      setExpediente(detailData.expediente);

      const { data: evData } = await evidenciasApi.get(id);
      setEvidencias(evData.evidencias || []);
      setNumeroFactura(evData.expediente.numero_factura || FACTURA_PREFIX);
    } catch (err) {
      console.error("Error cargando expediente:", err);
      setToast({ type: "error", message: "Error al cargar el expediente" });
    } finally {
      setLoading(false);
    }
  }

  function getPhotosByTipo(tipo) {
    return evidencias
      .filter((e) => e.tipo === tipo)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  /**
   * Sube múltiples archivos secuencialmente del mismo tipo.
   */
  async function handleBulkUpload(tipo, files) {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const existing = evidencias.filter((e) => e.tipo === tipo);
    const remaining = MAX_PHOTOS - existing.length;

    if (remaining <= 0) {
      setToast({
        type: "error",
        message: `Ya tienes ${MAX_PHOTOS} fotos. Elimina alguna antes de subir más.`,
      });
      return;
    }

    let toUpload = fileArray;
    if (fileArray.length > remaining) {
      setToast({
        type: "warning",
        message: `Solo se subirán las primeras ${remaining} (máximo ${MAX_PHOTOS} por tipo)`,
      });
      toUpload = fileArray.slice(0, remaining);
    }

    // Validación cliente
    const invalid = toUpload.find(
      (f) => !["image/jpeg", "image/png"].includes(f.type) || f.size > MAX_SIZE
    );
    if (invalid) {
      setToast({
        type: "error",
        message: `"${invalid.name}" no es válido. Solo JPG/PNG hasta 5 MB.`,
      });
      return;
    }

    setUploadingType(tipo);
    const newEvidencias = [];
    let errorCount = 0;

    for (const file of toUpload) {
      try {
        // Sin orden → backend asigna el siguiente disponible
        const { data } = await evidenciasApi.upload(id, { tipo, file });
        newEvidencias.push(data.evidencia);
      } catch (err) {
        errorCount++;
        console.error(`Error subiendo ${file.name}:`, err);
      }
    }

    setEvidencias((prev) => [...prev, ...newEvidencias]);
    setUploadingType(null);

    if (newEvidencias.length > 0 && errorCount === 0) {
      setToast({
        type: "success",
        message: `${newEvidencias.length} foto${newEvidencias.length > 1 ? "s" : ""} subida${newEvidencias.length > 1 ? "s" : ""}`,
      });
    } else if (errorCount > 0) {
      setToast({
        type: "error",
        message: `${errorCount} archivo${errorCount > 1 ? "s" : ""} no se pudo subir`,
      });
    }
  }

  async function handleUploadPdf(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setToast({ type: "error", message: "El informe debe ser un archivo PDF" });
      return;
    }
    if (file.size > MAX_SIZE) {
      setToast({ type: "error", message: "El archivo excede 5 MB" });
      return;
    }

    setUploadingType("informe_laboratorio");
    try {
      const { data } = await evidenciasApi.upload(id, {
        tipo: "informe_laboratorio",
        file,
      });
      setEvidencias((prev) => {
        const filtered = prev.filter((e) => e.tipo !== "informe_laboratorio");
        return [...filtered, data.evidencia];
      });
      setToast({ type: "success", message: "Informe subido correctamente" });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al subir el informe";
      setToast({ type: "error", message: msg });
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDelete(evidenciaId) {
    try {
      await evidenciasApi.delete(evidenciaId);
      setEvidencias((prev) => prev.filter((e) => e.id !== evidenciaId));
      setToast({ type: "success", message: "Archivo eliminado" });
    } catch {
      setToast({ type: "error", message: "Error al eliminar" });
    }
  }

  /**
   * Reordena las fotos de un tipo (drag & drop).
   */
  async function handleReorder(tipo, newOrder) {
    // Optimistic update
    const ids = newOrder.map((p) => p.id);
    setEvidencias((prev) => {
      const others = prev.filter((e) => e.tipo !== tipo);
      const reordered = newOrder.map((p, i) => ({ ...p, orden: i + 1 }));
      return [...others, ...reordered];
    });

    try {
      await evidenciasApi.reorder(id, tipo, ids);
    } catch (err) {
      setToast({ type: "error", message: "Error al reordenar. Recargando..." });
      loadData();
    }
  }

  async function handleFacturaBlur() {
    if (numeroFactura === FACTURA_PREFIX) return;
    try {
      await evidenciasApi.updateFactura(id, numeroFactura);
    } catch {
      // Silencioso
    }
  }

  function handleFacturaChange(e) {
    let value = e.target.value.toUpperCase();
    // Asegurar que siempre empiece con E001-
    if (!value.startsWith(FACTURA_PREFIX)) {
      value = FACTURA_PREFIX + value.replace(/[^\d]/g, "");
    } else {
      // Solo permitir dígitos después del prefijo
      const suffix = value.substring(FACTURA_PREFIX.length).replace(/[^\d]/g, "");
      value = FACTURA_PREFIX + suffix;
    }
    setNumeroFactura(value);
  }

  async function handleSave() {
    if (!facturaValid) {
      setToast({
        type: "error",
        message: "Verifique el N° de factura (mínimo 2 dígitos después del prefijo)",
      });
      return;
    }
    if (!isComplete) {
      setToast({ type: "error", message: "Complete todas las evidencias requeridas" });
      return;
    }

    setSaving(true);
    try {
      await evidenciasApi.updateFactura(id, numeroFactura);
      await evidenciasApi.guardar(id);
      setToast({ type: "success", message: "Evidencias guardadas correctamente" });
      setTimeout(() => navigate(`/expedientes?open=${id}`), 1500);
    } catch (err) {
      const msg = err.response?.data?.error || "Error al guardar evidencias";
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  // ── Derivados ──
  const inoculacionPhotos = getPhotosByTipo("foto_inoculacion");
  const monitoreoPhotos = getPhotosByTipo("foto_monitoreo");
  const informe = evidencias.find((e) => e.tipo === "informe_laboratorio");

  // Validación de factura: solo válida si tiene al menos 2 dígitos después del prefijo
  const facturaValid = FACTURA_REGEX.test(numeroFactura);
  const facturaTouched = numeroFactura.length > FACTURA_PREFIX.length;

  const isComplete =
    inoculacionPhotos.length === 4 &&
    monitoreoPhotos.length === 4 &&
    !!informe &&
    facturaValid;

  const totalNeeded = 10;
  const totalDone =
    inoculacionPhotos.length + monitoreoPhotos.length + (informe ? 1 : 0) + (facturaValid ? 1 : 0);
  const percent = Math.round((totalDone / totalNeeded) * 100);

  if (loading) {
    return (
      <div className="evid-page">
        <div className="evid-loading">
          <Loader size={20} className="spin" /> Cargando expediente...
        </div>
      </div>
    );
  }

  if (!expediente) {
    return <div className="evid-page"><div className="evid-loading">Expediente no encontrado</div></div>;
  }

  return (
    <div className="evid-page">
      <button className="det-back" onClick={() => navigate(`/expedientes?open=${id}`)}>
        <ChevronLeft size={16} /> Volver al expediente
      </button>

      {/* Hero */}
      <div className="evid-hero">
        <div className="evid-hero-text">
          <span className="evid-hero-label">Expediente #{expediente.id}</span>
          <h1 className="evid-hero-title">Completar evidencias</h1>
          <p className="evid-hero-subtitle">
            {expediente.cliente || "Cliente sin asignar"}
            {expediente.nis && <> · NIS {expediente.nis}</>}
          </p>
        </div>
        <ProgressRing percent={percent} />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> :
           toast.type === "warning" ? <AlertCircle size={16} /> :
           <AlertCircle size={16} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sección 1: Fotos de inoculación */}
      <EvidenciaSection
        title="Fotos de inoculación"
        subtitle="Sube hasta 4 imágenes JPG o PNG"
        icon={<Camera size={18} />}
        accent="blue"
        count={inoculacionPhotos.length}
        total={4}
      >
        <PhotoUploader
          tipo="foto_inoculacion"
          photos={inoculacionPhotos}
          uploading={uploadingType === "foto_inoculacion"}
          accent="blue"
          onUpload={(files) => handleBulkUpload("foto_inoculacion", files)}
          onDelete={handleDelete}
          onReorder={(newOrder) => handleReorder("foto_inoculacion", newOrder)}
        />
      </EvidenciaSection>

      {/* Sección 2: Fotos de monitoreo */}
      <EvidenciaSection
        title="Fotos de monitoreo"
        subtitle="Sube hasta 4 imágenes JPG o PNG"
        icon={<Camera size={18} />}
        accent="teal"
        count={monitoreoPhotos.length}
        total={4}
      >
        <PhotoUploader
          tipo="foto_monitoreo"
          photos={monitoreoPhotos}
          uploading={uploadingType === "foto_monitoreo"}
          accent="teal"
          onUpload={(files) => handleBulkUpload("foto_monitoreo", files)}
          onDelete={handleDelete}
          onReorder={(newOrder) => handleReorder("foto_monitoreo", newOrder)}
        />
      </EvidenciaSection>

      {/* Sección 3: Informe de laboratorio */}
      <EvidenciaSection
        title="Informe de laboratorio"
        subtitle="PDF con los resultados del análisis"
        icon={<FileText size={18} />}
        accent="purple"
        count={informe ? 1 : 0}
        total={1}
      >
        <PdfSlot
          evidencia={informe}
          uploading={uploadingType === "informe_laboratorio"}
          onUpload={handleUploadPdf}
          onDelete={() => informe && handleDelete(informe.id)}
        />
      </EvidenciaSection>

      {/* Sección 4: N° de factura */}
      <EvidenciaSection
        title="Número de factura"
        subtitle="Comprobante de pago del servicio"
        icon={<Receipt size={18} />}
        accent="amber"
        count={facturaValid ? 1 : 0}
        total={1}
      >
        <div className="factura-input-wrapper">
          <input
            type="text"
            className={`factura-input ${
              facturaTouched && !facturaValid ? "invalid" : ""
            } ${facturaValid ? "valid" : ""}`}
            value={numeroFactura}
            onChange={handleFacturaChange}
            onBlur={handleFacturaBlur}
            onFocus={(e) => {
              // Si está vacío o solo el prefijo, posicionar cursor al final
              if (e.target.value === FACTURA_PREFIX) {
                setTimeout(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length), 0);
              }
            }}
            maxLength={20}
          />
          {facturaTouched && !facturaValid && (
            <div className="factura-hint invalid">
              <AlertCircle size={14} /> Ingresa al menos 2 dígitos
            </div>
          )}
          {facturaValid && (
            <div className="factura-hint valid">
              <CheckCircle size={14} /> Formato válido
            </div>
          )}
        </div>
      </EvidenciaSection>

      {/* Save bar */}
      <div className="evid-save-bar">
        <div className="evid-save-status">
          {isComplete ? (
            <><CheckCircle size={16} className="ic-ok" /> Listo para guardar</>
          ) : (
            <>
              <AlertCircle size={16} className="ic-warn" />
              Faltan {totalNeeded - totalDone} de {totalNeeded} elementos
            </>
          )}
        </div>
        <button
          className="btn btn-primary btn-lg"
          disabled={!isComplete || saving}
          onClick={handleSave}
        >
          {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
          Guardar evidencias
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  Sub-components
// ══════════════════════════════════════════

function EvidenciaSection({ title, subtitle, icon, accent, count, total, children }) {
  const complete = count === total;
  return (
    <div className={`evid-section accent-${accent} ${complete ? "complete" : ""}`}>
      <div className="evid-section-header">
        <div className="evid-section-icon">{icon}</div>
        <div className="evid-section-title-wrap">
          <h2 className="evid-section-title">
            {title}
            <span className={`evid-section-count ${complete ? "complete" : ""}`}>
              {count}/{total}
            </span>
          </h2>
          <p className="evid-section-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="evid-section-body">{children}</div>
    </div>
  );
}

/**
 * Photo uploader with multi-file drop and drag-to-reorder.
 */
function PhotoUploader({ tipo, photos, uploading, accent, onUpload, onDelete, onReorder }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragItemIdx = useRef(null);
  const dragOverItemIdx = useRef(null);
  const [, forceRender] = useState(0);

  const isFull = photos.length >= MAX_PHOTOS;
  const remaining = MAX_PHOTOS - photos.length;

  // ── File input ──
  function handleFileInput(e) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onUpload(files);
    e.target.value = "";
  }

  // ── External drop (subir nuevos) ──
  function handleExternalDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!e.dataTransfer.types.includes("Files")) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) onUpload(files);
  }

  function handleExternalDragOver(e) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  }

  // ── Reorder dentro del grid ──
  function handleCardDragStart(idx, e) {
    dragItemIdx.current = idx;
    e.dataTransfer.effectAllowed = "move";
    // Set custom data so external drop zone ignores this drag
    e.dataTransfer.setData("application/x-photo-reorder", String(idx));
  }

  function handleCardDragEnter(idx) {
    dragOverItemIdx.current = idx;
    forceRender((n) => n + 1);
  }

  function handleCardDragOver(e) {
    e.preventDefault();
  }

  function handleCardDragEnd() {
    const from = dragItemIdx.current;
    const to = dragOverItemIdx.current;

    if (from !== null && to !== null && from !== to) {
      const newOrder = [...photos];
      const [moved] = newOrder.splice(from, 1);
      newOrder.splice(to, 0, moved);
      onReorder(newOrder);
    }

    dragItemIdx.current = null;
    dragOverItemIdx.current = null;
    forceRender((n) => n + 1);
  }

  return (
    <div className="photo-uploader">
      {/* Drop zone — siempre visible (deshabilitada cuando full) */}
      <div
        className={`photo-dropzone ${dragging ? "dragging" : ""} ${isFull ? "disabled" : ""} accent-${accent}`}
        onClick={() => !isFull && !uploading && fileInputRef.current?.click()}
        onDragOver={handleExternalDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleExternalDrop}
      >
        {uploading ? (
          <>
            <Loader size={22} className="spin" />
            <span className="dz-main">Subiendo fotos...</span>
          </>
        ) : isFull ? (
          <>
            <CheckCircle size={22} />
            <span className="dz-main">Fotos completas</span>
            <span className="dz-sub">Elimina alguna para subir nuevas</span>
          </>
        ) : (
          <>
            <Upload size={22} />
            <span className="dz-main">
              Arrastra fotos aquí o haz click para seleccionar
            </span>
            <span className="dz-sub">
              Puedes subir hasta {remaining} foto{remaining > 1 ? "s" : ""} · JPG/PNG · 5 MB
            </span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          hidden
          onChange={handleFileInput}
        />
      </div>

      {/* Grid de fotos cargadas (con drag para reordenar) */}
      {photos.length > 0 && (
        <>
          {photos.length > 1 && (
            <div className="photo-reorder-hint">
              <GripVertical size={12} />
              Arrastra las fotos para cambiar el orden
            </div>
          )}
          <div className="photo-grid">
            {photos.map((photo, idx) => {
              const url = `${API_BASE}/${photo.ruta_archivo.replace(/\\/g, "/")}`;
              const isDragging = dragItemIdx.current === idx;
              const isDragOver = dragOverItemIdx.current === idx && !isDragging;
              return (
                <div
                  key={photo.id}
                  className={`photo-card ${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""}`}
                  draggable
                  onDragStart={(e) => handleCardDragStart(idx, e)}
                  onDragEnter={() => handleCardDragEnter(idx)}
                  onDragOver={handleCardDragOver}
                  onDragEnd={handleCardDragEnd}
                >
                  <img src={url} alt={`Foto ${idx + 1}`} />
                  <div className="photo-card-num">{idx + 1}</div>
                  <button
                    className="photo-card-del"
                    onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                    title="Eliminar"
                  >
                    <X size={14} />
                  </button>
                  <div className="photo-card-grip">
                    <GripVertical size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PdfSlot({ evidencia, uploading, onUpload, onDelete }) {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  function formatSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (uploading) {
    return (
      <div className="pdf-slot uploading">
        <Loader size={24} className="spin" />
        <span>Subiendo...</span>
      </div>
    );
  }

  if (evidencia) {
    return (
      <div className="pdf-slot filled">
        <div className="pdf-icon">
          <FileText size={28} />
        </div>
        <div className="pdf-info">
          <div className="pdf-name">{evidencia.nombre_archivo}</div>
          <div className="pdf-meta">{formatSize(evidencia.tamano_bytes)} · PDF</div>
        </div>
        <div className="pdf-actions">
          <button className="pdf-btn" onClick={() => fileInputRef.current?.click()}>
            Reemplazar
          </button>
          <button className="pdf-btn pdf-btn-del" onClick={onDelete} title="Eliminar">
            <X size={14} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div
      className={`pdf-slot empty ${dragging ? "dragging" : ""}`}
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <Upload size={28} />
      <div className="pdf-hint-main">Arrastra el PDF o haz click para seleccionar</div>
      <div className="pdf-hint-sub">Solo PDF · Máximo 5 MB</div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}

function ProgressRing({ percent }) {
  const size = 76;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="progress-ring-wrap">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-bg" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-fill"
        />
      </svg>
      <div className="ring-label">{percent}%</div>
    </div>
  );
}
