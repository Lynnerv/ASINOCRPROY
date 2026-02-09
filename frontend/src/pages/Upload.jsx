/**
 * Página de carga de cartas (HU-04).
 *
 * Header/footer manejados por Layout.
 * Criterios: drag-drop, validación JPG/PNG ≤5MB, barra de progreso,
 * eliminar antes de confirmar, mensaje de éxito/error.
 */

import { useState, useRef, useCallback } from "react";
import { documentApi } from "../api/documents";
import {
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ImagePlus,
} from "lucide-react";
import "../styles/upload.css";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];

export default function UploadPage() {
  const fileInputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Formato no compatible. Solo: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Excede 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    }
    return null;
  }

  const addFiles = useCallback(
    (newFiles) => {
      setResult(null);
      const errors = [];
      const valid = [];

      Array.from(newFiles).forEach((file) => {
        const isDuplicate = files.some(
          (f) => f.file.name === file.name && f.file.size === file.size
        );
        if (isDuplicate) {
          errors.push(`${file.name}: ya agregado`);
          return;
        }
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          valid.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            file,
            preview: URL.createObjectURL(file),
          });
        }
      });

      if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
      if (errors.length > 0) {
        setResult({ type: "error", message: "Algunos archivos no se pudieron agregar:", details: errors });
      }
    },
    [files]
  );

  function removeFile(id) {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.id !== id);
    });
  }

  function clearFiles() {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setResult(null);
    setProgress(0);
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) addFiles(e.dataTransfer.files);
  }

  function handleFileInput(e) {
    if (e.target.files?.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);
    setResult(null);

    try {
      const { data } = await documentApi.upload(
        files.map((f) => f.file),
        (pct) => setProgress(pct)
      );
      setProgress(100);
      setResult({
        type: "success",
        message: data.mensaje,
        details: data.errores > 0 ? [`${data.errores} archivo(s) con error al registrar`] : null,
      });
      setTimeout(() => {
        files.forEach((f) => URL.revokeObjectURL(f.preview));
        setFiles([]);
      }, 500);
    } catch (err) {
      setResult({ type: "error", message: err.response?.data?.error || "Error de conexión con el servidor" });
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div className="upload-page">
      <div className="upload-title-row">
        <div>
          <h1>Cargar Cartas</h1>
          <p>Suba las cartas de notificación para su procesamiento con OCR + IA</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone ${dragActive ? "drag-active" : ""} ${uploading ? "disabled" : ""}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
        <div className="drop-zone-content">
          <div className="drop-icon">
            <ImagePlus size={28} />
          </div>
          <p className="drop-title">
            {dragActive ? "Suelta los archivos aquí" : "Arrastra las cartas aquí o haz clic para seleccionar"}
          </p>
          <p className="drop-subtitle">JPG o PNG · Máximo 5 MB por archivo</p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <span className="file-count">{files.length} archivo{files.length !== 1 ? "s" : ""}</span>
            {!uploading && (
              <button className="clear-btn" onClick={clearFiles}>
                <Trash2 size={13} />
                Limpiar
              </button>
            )}
          </div>
          <div className="file-items">
            {files.map((f) => (
              <div key={f.id} className="file-item">
                <div className="file-thumb">
                  <img src={f.preview} alt={f.file.name} />
                </div>
                <div className="file-info">
                  <span className="file-name">{f.file.name}</span>
                  <span className="file-size">{formatSize(f.file.size)}</span>
                </div>
                {!uploading && (
                  <button className="file-remove" onClick={() => removeFile(f.id)} aria-label="Eliminar">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <span className="progress-text">Subiendo… {progress}%</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`result-msg ${result.type}`}>
          {result.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>
            <p className="result-title">{result.message}</p>
            {result.details && (
              <ul className="result-details">
                {result.details.map((d, i) => (<li key={i}>{d}</li>))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="upload-footer">
        <button className="upload-btn" onClick={handleUpload} disabled={files.length === 0 || uploading}>
          {uploading ? (
            <><span className="spinner"></span>Subiendo…</>
          ) : (
            <><Upload size={17} />Subir {files.length > 0 ? `(${files.length})` : ""}</>
          )}
        </button>
      </div>
    </div>
  );
}
