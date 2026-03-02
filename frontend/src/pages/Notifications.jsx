import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications";
import "../styles/notifications.css";

const TABS = [
  { key: "TODAS", label: "Todas" },
  { key: "OCR", label: "OCR" },
  { key: "CARGA", label: "Carga" },
  { key: "EXPEDIENTE", label: "Expediente" },
  { key: "ERROR", label: "Errores" },
];

export default function Notifications() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("TODAS");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ tipo: tab });
      setItems(res.data.notificaciones || []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const unreadLocal = useMemo(() => items.filter((x) => !x.leida).length, [items]);

  async function markAll() {
    await notificationsApi.markAllRead();
    await load();
  }

  async function markOne(id) {
    await notificationsApi.markRead(id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, leida: true } : x)));
  }

  async function openNotif(n) {
    if (!n.leida) await markOne(n.id);

    if (n.referencia_tipo === "documento" && n.referencia_id) {
      return navigate(`/documentos/${n.referencia_id}`);
    }
    if (n.referencia_tipo === "expediente" && n.referencia_id) {
      return navigate(`/expedientes/${n.referencia_id}/detalle`);
    }
  }

  return (
    <div className="nt-page">
      <div className="nt-head">
        <div>
          <h2 className="nt-title">Centro de Notificaciones</h2>
          <div className="nt-sub">
            Tienes <b>{unreadLocal}</b> notificación(es) sin leer
          </div>
        </div>

        <div className="nt-actions">
          <button className="nt-btn" onClick={load} type="button">
            Actualizar
          </button>
          <button className="nt-btn primary" onClick={markAll} type="button">
            Marcar todas como leídas
          </button>
        </div>
      </div>

      <div className="nt-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
            className={`nt-tab ${tab === t.key ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="nt-list">
        {loading ? (
          <div className="nt-empty">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="nt-empty">
            <div className="nt-empty-icon">🔔</div>
            <div className="nt-empty-title">No hay notificaciones</div>
            <div className="nt-empty-sub">Estás al día.</div>
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`nt-card ${n.leida ? "read" : "unread"}`}
              onClick={() => openNotif(n)}
              role="button"
              tabIndex={0}
            >
              <div className="nt-card-left">
                <div className="nt-type">{n.tipo}</div>

                <div className="nt-main">
                  <div className="nt-card-title">
                    {n.titulo} {!n.leida && <span className="nt-dot">•</span>}
                  </div>
                  <div className="nt-card-msg">{n.mensaje}</div>
                  <div className="nt-card-meta">{formatDateTime(n.created_at)}</div>
                </div>
              </div>

              <div className="nt-card-right">
                {!n.leida ? (
                  <button
                    className="nt-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      markOne(n.id);
                    }}
                  >
                    Marcar leída
                  </button>
                ) : (
                  <span className="nt-read">Leída</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}