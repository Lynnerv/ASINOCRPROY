import { useState, useRef, useCallback } from "react";
import {
  Upload, X, CheckCircle, AlertCircle, Loader, FileImage,
  ChevronRight, FolderOpen,
} from "lucide-react";
import { documentApi } from "../api/documents";
import "../styles/cargar-modal.css";

const CONCURRENCY = 3;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/jpg"];
const MAX_SIZE = 10 * 1024 * 1024;

export default function CargarModal({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expedienteId, setExpedienteId] = useState(null);
  const [docIds, setDocIds] = useState([]);
  const [processingStatus, setProcessingStatus] = useState([]);
  const [results, setResults] = useState({ ok: 0, errors: 0, total: 0 });
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const dragRef = useRef(null);

  function reset() {
    setStep(1);
    setFiles([]);
    setUploading(false);
    setUploadProgress(0);
    setExpedienteId(null);
    setDocIds([]);
    setProcessingStatus([]);
    setResults({ ok: 0, errors: 0, total: 0 });
    setError(null);
  }

  function handleClose() {
    if (step === 3) {
      onComplete?.(expedienteId);
    }
    reset();
    onClose();
  }

  function validateFiles(fileList) {
    const valid = [];
    const rejected = [];
    for (const f of fileList) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        rejected.push(`${f.name}: formato no soportado`);
      } else if (f.size > MAX_SIZE) {
        rejected.push(`${f.name}: excede 10MB`);
      } else {
        valid.push(f);
      }
    }
    if (rejected.length > 0) {
      setError(`Archivos rechazados: ${rejected.join(", ")}`);
    }
    return valid;
  }

  function handleFileSelect(e) {
    const selected = validateFiles(Array.from(e.target.files || []));
    if (selected.length > 0) {
      setFiles(selected);
      setError(null);
      startUploadAndProcess(selected);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current?.classList.remove("drag-over");
    const dropped = validateFiles(Array.from(e.dataTransfer.files || []));
    if (dropped.length > 0) {
      setFiles(dropped);
      setError(null);
      startUploadAndProcess(dropped);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current?.classList.add("drag-over");
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragRef.current?.classList.remove("drag-over");
  }

  async function startUploadAndProcess(selectedFiles) {
    setStep(2);
    setUploading(true);

    const statusList = selectedFiles.map((f, i) => ({
      id: i,
      name: f.name,
      status: "uploading",
      docId: null,
      result: null,
    }));
    setProcessingStatus([...statusList]);

    try {
      const { data } = await documentApi.upload(selectedFiles, (p) => setUploadProgress(p));
      const expId = data.expediente_id || data.expedienteId;
      const docs = data.documentos || data.documents || [];
      setExpedienteId(expId);
      setDocIds(docs.map((d) => d.id));

      statusList.forEach((s, i) => {
        if (docs[i]) {
          s.docId = docs[i].id;
          s.status = "pending";
        } else {
          s.status = "error";
          s.result = { error: "No se creo el registro" };
        }
      });
      setProcessingStatus([...statusList]);
      setUploading(false);

      await processDocuments(statusList);
    } catch (err) {
      setError(err.response?.data?.error || "Error al subir los archivos");
      setUploading(false);
      statusList.forEach((s) => {
        if (s.status === "uploading") s.status = "error";
      });
      setProcessingStatus([...statusList]);
    }
  }

  async function processDocuments(statusList) {
    const queue = statusList
      .filter((s) => s.status === "pending" && s.docId)
      .map((s) => s.id);

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queue.length) },
      async () => {
        while (queue.length > 0) {
          const idx = queue.shift();
          if (idx === undefined) break;
          const item = statusList[idx];

          item.status = "processing";
          setProcessingStatus([...statusList]);

          try {
            const { data } = await documentApi.processOne(item.docId);
            item.status = data.estado === "error" ? "error" : "done";
            item.result = data;
          } catch (err) {
            item.status = "error";
            item.result = { error: err.response?.data?.error || err.message };
          }

          setProcessingStatus([...statusList]);
        }
      }
    );

    await Promise.all(workers);

    const ok = statusList.filter((s) => s.status === "done").length;
    const errors = statusList.filter((s) => s.status === "error").length;
    setResults({ ok, errors, total: statusList.length });
    setStep(3);
  }

  if (!open) return null;

  return (
    <div className="cm-backdrop" onClick={handleClose}>
      <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cm-close" onClick={handleClose}><X size={18} /></button>

        {/* Steps indicator */}
        <div className="cm-steps">
          <div className={`cm-step ${step >= 1 ? "active" : ""}`}>
            <span className="cm-step-num">1</span>
            <span className="cm-step-label">Seleccionar</span>
          </div>
          <div className="cm-step-line"></div>
          <div className={`cm-step ${step >= 2 ? "active" : ""}`}>
            <span className="cm-step-num">2</span>
            <span className="cm-step-label">Procesando</span>
          </div>
          <div className="cm-step-line"></div>
          <div className={`cm-step ${step >= 3 ? "active" : ""}`}>
            <span className="cm-step-num">3</span>
            <span className="cm-step-label">Resultado</span>
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="cm-body">
            <div
              className="cm-dropzone"
              ref={dragRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={32} className="cm-drop-icon" />
              <span className="cm-drop-title">Arrastra las cartas aqui</span>
              <span className="cm-drop-subtitle">o haz click para seleccionar archivos</span>
              <span className="cm-drop-formats">JPG, PNG - maximo 10MB por archivo</span>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>
            {error && (
              <div className="cm-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="cm-body">
            {uploading && (
              <div className="cm-upload-bar">
                <span>Subiendo archivos...</span>
                <div className="cm-progress">
                  <div className="cm-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <div className="cm-file-list">
              {processingStatus.map((item) => (
                <div key={item.id} className={`cm-file-item cm-file-${item.status}`}>
                  <div className="cm-file-icon">
                    {item.status === "uploading" && <Loader size={16} className="spin" />}
                    {item.status === "pending" && <FileImage size={16} />}
                    {item.status === "processing" && <Loader size={16} className="spin" />}
                    {item.status === "done" && <CheckCircle size={16} />}
                    {item.status === "error" && <AlertCircle size={16} />}
                  </div>
                  <span className="cm-file-name">{item.name}</span>
                  <span className="cm-file-status">
                    {item.status === "uploading" && "Subiendo..."}
                    {item.status === "pending" && "En cola"}
                    {item.status === "processing" && "Procesando OCR..."}
                    {item.status === "done" && "Completado"}
                    {item.status === "error" && (item.result?.error || "Error")}
                  </span>
                </div>
              ))}
            </div>

            {!uploading && (
              <div className="cm-processing-summary">
                <Loader size={16} className="spin" />
                <span>
                  Procesando {processingStatus.filter((s) => s.status === "done" || s.status === "error").length} de {processingStatus.length} cartas...
                </span>
              </div>
            )}

            {error && (
              <div className="cm-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="cm-body">
            <div className="cm-result-hero">
              {results.errors === 0 ? (
                <div className="cm-result-icon cm-result-ok">
                  <CheckCircle size={32} />
                </div>
              ) : (
                <div className="cm-result-icon cm-result-partial">
                  <AlertCircle size={32} />
                </div>
              )}
              <h3 className="cm-result-title">
                {results.errors === 0
                  ? "Procesamiento completado"
                  : "Procesamiento finalizado con observaciones"}
              </h3>
              <p className="cm-result-text">
                {results.ok} de {results.total} carta{results.total !== 1 ? "s" : ""} procesada{results.total !== 1 ? "s" : ""} correctamente
                {results.errors > 0 && `. ${results.errors} con errores.`}
              </p>
            </div>

            <div className="cm-file-list">
              {processingStatus.map((item) => (
                <div key={item.id} className={`cm-file-item cm-file-${item.status}`}>
                  <div className="cm-file-icon">
                    {item.status === "done" && <CheckCircle size={16} />}
                    {item.status === "error" && <AlertCircle size={16} />}
                  </div>
                  <span className="cm-file-name">{item.name}</span>
                  <span className="cm-file-status">
                    {item.status === "done" && "Procesado"}
                    {item.status === "error" && (item.result?.error || "Error")}
                  </span>
                </div>
              ))}
            </div>

            <div className="cm-result-actions">
              {expedienteId && (
                <button className="btn btn-primary cm-result-btn" onClick={handleClose}>
                  <FolderOpen size={16} />
                  Ver expediente
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
