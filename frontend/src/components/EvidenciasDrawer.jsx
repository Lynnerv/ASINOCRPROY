import { useState, useEffect, useRef } from "react";
import {
  X, Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader,
} from "lucide-react";
import { evidenciasApi } from "../api/evidencias";
import "../styles/evidencias-drawer.css";

export default function EvidenciasDrawer({ open, expedienteId, onClose, onSaved }) {
  const [currentFile, setCurrentFile] = useState(null);
  const [newFile, setNewFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (open && expedienteId) {
      loadExisting();
      setNewFile(null);
      setError(null);
      setSuccess(false);
    }
  }, [open, expedienteId]);

  async function loadExisting() {
    try {
      const { data } = await evidenciasApi.get(expedienteId);
      const informe = (data.evidencias || []).find((e) => e.tipo === "informe_laboratorio");
      setCurrentFile(informe || null);
    } catch {}
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current?.classList.remove("drag-over");
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  }

  function validateAndSet(file) {
    if (file.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo no debe superar 20MB");
      return;
    }
    setError(null);
    setNewFile(file);
  }

  async function handleUploadAndSave() {
    if (!newFile) {
      setError("Seleccione un archivo PDF");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await evidenciasApi.upload(expedienteId, {
        tipo: "informe_laboratorio",
        orden: 0,
        file: newFile,
        onProgress: setUploadProgress,
      });

      setSaving(true);
      await evidenciasApi.guardar(expedienteId);
      setSuccess(true);
      setTimeout(() => {
        onSaved();
      }, 800);
    } catch (err) {
      setError(err.response?.data?.error || "Error al subir el archivo");
    } finally {
      setUploading(false);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentFile) return;
    try {
      await evidenciasApi.delete(currentFile.id);
      setCurrentFile(null);
    } catch (err) {
      setError("Error al eliminar el archivo");
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="ed-overlay" onClick={onClose}></div>
      <div className="ed-drawer">
        <div className="ed-header">
          <h3>Informe de laboratorio</h3>
          <button className="ed-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ed-body">
          {success ? (
            <div className="ed-success">
              <CheckCircle size={32} />
              <span>Informe guardado correctamente</span>
            </div>
          ) : (
            <>
              {currentFile && !newFile && (
                <div className="ed-current">
                  <div className="ed-current-info">
                    <FileText size={18} />
                    <div>
                      <span className="ed-current-name">{currentFile.nombre_archivo}</span>
                      <span className="ed-current-date">
                        Subido el {new Date(currentFile.creado_en).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <button className="ed-delete" onClick={handleDelete} title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}

              <div
                className={`ed-dropzone ${newFile ? "ed-dropzone-ready" : ""}`}
                ref={dragRef}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); dragRef.current?.classList.add("drag-over"); }}
                onDragLeave={(e) => { e.preventDefault(); dragRef.current?.classList.remove("drag-over"); }}
                onClick={() => inputRef.current?.click()}
              >
                {newFile ? (
                  <>
                    <FileText size={24} className="ed-drop-icon-ready" />
                    <span className="ed-drop-filename">{newFile.name}</span>
                    <span className="ed-drop-size">{(newFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="ed-drop-change">Click para cambiar archivo</span>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="ed-drop-icon" />
                    <span className="ed-drop-title">{currentFile ? "Reemplazar informe" : "Subir informe de laboratorio"}</span>
                    <span className="ed-drop-subtitle">Arrastra el PDF aqui o haz click para seleccionar</span>
                    <span className="ed-drop-formats">PDF - maximo 20MB</span>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </div>

              {uploading && (
                <div className="ed-progress">
                  <div className="ed-progress-bar">
                    <div className="ed-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <span className="ed-progress-text">{saving ? "Guardando..." : `Subiendo ${uploadProgress}%`}</span>
                </div>
              )}

              {error && (
                <div className="ed-error"><AlertCircle size={14} /> {error}</div>
              )}
            </>
          )}
        </div>

        {!success && (
          <div className="ed-footer">
            <button className="btn btn-primary ed-save" onClick={handleUploadAndSave}
              disabled={!newFile || uploading || saving}>
              {uploading || saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
              Guardar informe
            </button>
          </div>
        )}
      </div>
    </>
  );
}
