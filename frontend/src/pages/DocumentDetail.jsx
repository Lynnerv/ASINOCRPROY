import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { documentApi } from "../api/documents";
import { Loader, Download, ArrowLeft } from "lucide-react";
import "../styles/document-detail.css";

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3000";

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const [blobUrl, setBlobUrl] = useState(null);
  const [fileLoading, setFileLoading] = useState(true);
  const [fileError, setFileError] = useState(null);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    let currentUrl = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFileLoading(true);
      setFileError(null);

      try {
        // 1. Datos
        const dRes = await documentApi.getById(id);
        if (cancelled) return;
        setDoc(dRes.data.documento);

        // 2. Archivo (Blob seguro)
        const bRes = await documentApi.getFileBlob(id);
        if (bRes.data.type === "application/json") throw new Error();
        
        currentUrl = URL.createObjectURL(bRes.data);
        if (cancelled) return;
        
        setBlobUrl(currentUrl);
        setIsPdf(dRes.data.documento.nombre_archivo?.toLowerCase().endsWith('.pdf'));
      } catch (e) {
        if (!cancelled) setFileError("Error al cargar vista previa.");
      } finally {
        if (!cancelled) { setLoading(false); setFileLoading(false); }
      }
    }
    load();
    return () => { if (currentUrl) URL.revokeObjectURL(currentUrl); cancelled = true; };
  }, [id]);

  async function onDownload() {
    try {
      const res = await documentApi.downloadOriginal(id);
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc?.nombre_archivo || `archivo_${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error en descarga", e);
    }
  }

    if (loading) {
      return (
        <div className="dd-loading">
          <Loader size={18} className="spin" /> Cargando detalle...
        </div>
      );
    }

  if (!doc) {
    return <div className="dd-loading">No se pudo cargar el documento.</div>;
  }

  return (
    <div className="dd-page">
      <div className="dd-topbar">
        <button className="dd-back" onClick={() => navigate(-1)} type="button">
          <ArrowLeft size={16} /> Volver
        </button>

        <button className="dd-download" onClick={onDownload} type="button">
          <Download size={16} /> Descargar
        </button>
      </div>

      <div className="dd-grid">
        <div className="dd-card">
          <div className="dd-card-head">Vista previa</div>

          {fileLoading ? (
            <div className="dd-loading">
              <Loader size={18} className="spin" /> Cargando archivo...
            </div>
          ) : fileError ? (
            <div className="dd-loading">{fileError}</div>
          ) : isPdf ? (
            <iframe className="dd-pdf" src={blobUrl} title="PDF Preview" />
          ) : (
            <div className="dd-img-wrap">
              <img src={blobUrl} alt={doc.nombre_archivo} />
            </div>
          )}

          <div className="dd-filename">{doc.nombre_archivo}</div>
        </div>

        <div className="dd-right">
          <div className="dd-card">
            <div className="dd-card-head">Metadatos</div>
            <div className="dd-meta">
              <Meta label="NIS" value={doc.nis || "—"} />
              <Meta label="Cliente" value={doc.cliente || "—"} />
              <Meta label="Tipo" value={doc.tipo_notificacion || "—"} />
              <Meta
                label="Fecha"
                value={doc.fecha_carta ? formatDate(doc.fecha_carta) : "—"}
              />
              <Meta label="Estado" value={mapEstado(doc.estado)} />
            </div>
          </div>

          <div className="dd-card">
            <div className="dd-card-head">Campos OCR</div>
            <div className="dd-ocr">
              {(doc.ocr_fields || []).map((f) => (
                <div key={f.key} className="dd-ocr-row">
                  <div className="dd-ocr-left">
                    <span className="dd-ocr-label">{f.label}</span>
                    <span className="dd-ocr-value">{f.value || "—"}</span>
                  </div>
                  <span
                    className={`dd-pill ${
                      f.status === "correcto" ? "ok" : "warn"
                    }`}
                  >
                    {f.status === "correcto" ? "Correcto" : "A validar"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dd-card">
            <div className="dd-card-head">Historial / Auditoría</div>
            <div className="dd-history-empty">Próximamente</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="dd-meta-item">
      <span className="dd-meta-label">{label}</span>
      <span className="dd-meta-value">{value}</span>
    </div>
  );
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mapEstado(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pendiente") return "Pendiente";
  if (e === "procesando") return "En revisión";
  if (e === "procesado") return "Procesado";
  if (e === "validado") return "Archivado";
  if (e === "error") return "Error";
  return estado || "—";
}