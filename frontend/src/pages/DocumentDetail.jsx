import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { documentApi } from "../api/documents";
import { Loader, Download, ArrowLeft } from "lucide-react";
import "../styles/document-detail.css";

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

      // =========================
      // 1) Cargar metadatos (fatal si falla)
      // =========================
      try {
        const dRes = await documentApi.getById(id);
        const documento = dRes.data.documento;

        if (cancelled) return;
        setDoc(documento);
      } catch (e) {
        console.error("getById error:", e);
        if (!cancelled) {
          setDoc(null);
          setBlobUrl(null);
        }
        if (!cancelled) setLoading(false);
        if (!cancelled) setFileLoading(false);
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }

      // =========================
      // 2) Cargar archivo (NO es fatal si falla)
      // =========================
      try {
        const bRes = await documentApi.getFileBlob(id);
        const blob = bRes.data;

        // Si el backend devolvió error en JSON pero axios lo recibió como blob:
        const ct = (
          bRes.headers?.["content-type"] ||
          blob?.type ||
          ""
        ).toLowerCase();

        if (ct.includes("application/json")) {
          const text = await blob.text();
          throw new Error(`Servidor devolvió JSON (posible error): ${text}`);
        }

        // Detectar si es PDF
        const filename = String(
          (cancelled ? "" : (doc?.nombre_archivo || "")) // evita warning
        ).toLowerCase();

        const pdf =
          ct.includes("pdf") ||
          filename.endsWith(".pdf") ||
          String(doc?.tipo_archivo || "").toLowerCase() === "pdf";

        if (cancelled) return;

        setIsPdf(pdf);

        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (e) {
        console.error("getFileBlob error:", e);
        if (!cancelled) {
          setBlobUrl(null);
          setFileError("No se pudo cargar la vista previa del archivo.");
        }
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onDownload() {
    try {
      const res = await documentApi.downloadOriginal(id);
      const blob = res.data;
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      // Nombre real con extensión si existe
      a.download = doc?.nombre_archivo || `documento_${id}`;

      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("download error:", e);
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
          <div className="dd-card-head">Vista previa (Blob)</div>

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