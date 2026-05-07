/**
 * Preparar Servicio (HU-16).
 *
 * Permite al operador registrar el precio del servicio y la fecha
 * de programacion, visualizar un calendario con fechas ocupadas,
 * y generar la proforma y carta de programacion a partir de las
 * plantillas del sistema.
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Loader, X, Save,
  Download, Calendar, DollarSign, FileText, AlertCircle, CheckCircle,
} from "lucide-react";
import { servicioApi } from "../api/prepararServicio";
import "../styles/preparar-servicio.css";

export default function PrepararServicio() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [expediente, setExpediente] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [precio, setPrecio] = useState("");
  const [fechaProgramacion, setFechaProgramacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generando, setGenerando] = useState(null);
  const [toast, setToast] = useState(null);

  // Calendario
  const today = new Date();
  const [calAnio, setCalAnio] = useState(today.getFullYear());
  const [calMes, setCalMes] = useState(today.getMonth() + 1);
  const [fechasOcupadas, setFechasOcupadas] = useState([]);

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => { loadCalendario(); }, [calAnio, calMes]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadData() {
    setLoading(true);
    try {
      const { data } = await servicioApi.getDatos(id);
      setExpediente(data.expediente);
      setDocumentos(data.documentos || []);
      setPrecio(data.expediente.precio_servicio || "");
      setFechaProgramacion(data.expediente.fecha_programacion
        ? data.expediente.fecha_programacion.split("T")[0]
        : "");
    } catch (err) {
      console.error("Error cargando datos:", err);
      setToast({ type: "error", message: "Error al cargar los datos del expediente" });
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendario() {
    try {
      const { data } = await servicioApi.getCalendario(calAnio, calMes);
      setFechasOcupadas(data.fechas || []);
    } catch (err) {
      console.error("Error cargando calendario:", err);
    }
  }

  async function handleSave() {
    if (!precio && !fechaProgramacion) {
      setToast({ type: "error", message: "Ingrese al menos el precio o la fecha de programacion" });
      return;
    }

    setSaving(true);
    try {
      const datos = {};
      if (precio) datos.precio_servicio = parseFloat(precio);
      if (fechaProgramacion) datos.fecha_programacion = fechaProgramacion;

      await servicioApi.updateDatos(id, datos);
      await loadData();
      await loadCalendario();
      setToast({ type: "success", message: "Datos del servicio actualizados" });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al guardar";
      setToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerar(tipo) {
    setGenerando(tipo);
    try {
      // Guardar datos primero
      const datos = {};
      if (precio) datos.precio_servicio = parseFloat(precio);
      if (fechaProgramacion) datos.fecha_programacion = fechaProgramacion;
      if (Object.keys(datos).length > 0) {
        await servicioApi.updateDatos(id, datos);
      }

      const response = tipo === "proforma"
        ? await servicioApi.generarProforma(id)
        : await servicioApi.generarProgramacion(id);

      // Descargar archivo
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Extraer nombre del archivo del header o generar uno
      const disposition = response.headers["content-disposition"];
      let filename = `${tipo}_${expediente?.nis || id}.docx`;
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setToast({ type: "success", message: `Documento generado y descargado: ${filename}` });
    } catch (err) {
      const msg = err.response?.data?.error || `Error al generar ${tipo}`;
      setToast({ type: "error", message: msg });
    } finally {
      setGenerando(null);
    }
  }

  function handleSelectFecha(fecha) {
    // Verificar si la fecha esta ocupada
    const ocupada = fechasOcupadas.find(
      (f) => f.fecha_programacion?.split("T")[0] === fecha
    );
    if (ocupada && ocupada.id !== parseInt(id)) {
      setToast({
        type: "error",
        message: `Fecha ocupada por expediente #${ocupada.id} (${ocupada.cliente || "Sin cliente"} - NIS: ${ocupada.nis || "N/A"})`,
      });
      return;
    }
    setFechaProgramacion(fecha);
  }

  // Derivados
  const precioValido = precio && parseFloat(precio) > 0;
  const fechaValida = fechaProgramacion && fechaProgramacion.length === 10;

  if (loading) {
    return (
      <div className="prep-page">
        <div className="prep-loading"><Loader size={20} className="spin" /> Cargando datos del servicio...</div>
      </div>
    );
  }

  if (!expediente) {
    return (
      <div className="prep-page">
        <div className="prep-loading">Expediente no encontrado</div>
      </div>
    );
  }

  return (
    <div className="prep-page">
      <button className="det-back" onClick={() => navigate(`/expedientes?open=${id}`)}>
        <ChevronLeft size={16} /> Volver al expediente
      </button>

      {/* Encabezado */}
      <div className="prep-hero">
        <div className="prep-hero-text">
          <span className="prep-hero-label">Expediente #{expediente.id}</span>
          <h1 className="prep-hero-title">Preparar servicio</h1>
          <p className="prep-hero-subtitle">
            {expediente.cliente || "Cliente sin asignar"}
            {expediente.nis && <> - NIS {expediente.nis}</>}
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="prep-grid">
        {/* Columna izquierda: datos del cliente + precio + fecha */}
        <div className="prep-col-main">
          {/* Datos del cliente (solo lectura) */}
          <div className="prep-card">
            <div className="prep-card-header">
              <span className="prep-card-title">Datos del cliente</span>
              <span className="prep-card-badge">Extraidos por OCR</span>
            </div>
            <div className="prep-card-body">
              <div className="prep-fields">
                <ReadonlyField label="Cliente" value={expediente.cliente} />
                <ReadonlyField label="NIS" value={expediente.nis} mono />
                <ReadonlyField label="NIA" value={expediente.nia} mono />
                <ReadonlyField label="Direccion" value={expediente.direccion} />
                <ReadonlyField label="Distrito" value={expediente.distrito} />
              </div>
            </div>
          </div>

          {/* Datos de las cartas (solo lectura) */}
          <div className="prep-card">
            <div className="prep-card-header">
              <span className="prep-card-title">Datos de las cartas validadas</span>
              <span className="prep-card-badge">{documentos.length} documento{documentos.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="prep-card-body">
              {documentos.map((doc, i) => (
                <div key={doc.id} className="prep-doc-row">
                  <span className="prep-doc-anexo">{doc.anexo || `Doc ${i + 1}`}</span>
                  <div className="prep-doc-fields">
                    <span>Carta: <strong>{doc.numero_carta || "--"}</strong></span>
                    <span>Acta: <strong>{doc.numero_acta || "--"}</strong></span>
                    <span>Informe: <strong>{doc.numero_informe || "--"}</strong></span>
                  </div>
                  {doc.parametros && doc.parametros.length > 0 && (
                    <div className="prep-doc-params">
                      {doc.parametros.map((p) => (
                        <span key={p.codigo} className="prep-param-tag">
                          {p.codigo}: {p.resultado_valor || "--"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Precio y Fecha */}
          <div className="prep-card prep-card-action">
            <div className="prep-card-header">
              <span className="prep-card-title">Datos del servicio</span>
            </div>
            <div className="prep-card-body">
              <div className="prep-input-group">
                <label className="prep-label">
                  <DollarSign size={14} />
                  Precio del servicio (sin IGV)
                </label>
                <div className="prep-price-input">
                  <span className="prep-price-prefix">S/.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="prep-input"
                    placeholder="0.00"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                  />
                </div>
              </div>

              <div className="prep-input-group">
                <label className="prep-label">
                  <Calendar size={14} />
                  Fecha de programacion
                </label>
                <input
                  type="date"
                  className="prep-input"
                  value={fechaProgramacion}
                  onChange={(e) => setFechaProgramacion(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                {fechaProgramacion && (
                  <span className="prep-date-preview">
                    {formatFechaLarga(fechaProgramacion)}
                  </span>
                )}
              </div>

              <button
                className="btn btn-primary prep-save-btn"
                onClick={handleSave}
                disabled={saving || (!precioValido && !fechaValida)}
              >
                {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Guardar datos del servicio
              </button>
            </div>
          </div>

          {/* Generar documentos */}
          <div className="prep-card">
            <div className="prep-card-header">
              <span className="prep-card-title">Generar documentos</span>
            </div>
            <div className="prep-card-body">
              <div className="prep-gen-buttons">
                <button
                  className="prep-gen-btn"
                  onClick={() => handleGenerar("proforma")}
                  disabled={!precioValido || generando === "proforma"}
                >
                  <div className="prep-gen-icon">
                    {generando === "proforma" ? <Loader size={18} className="spin" /> : <FileText size={18} />}
                  </div>
                  <div className="prep-gen-info">
                    <span className="prep-gen-title">Generar Proforma</span>
                    <span className="prep-gen-desc">
                      {precioValido
                        ? "Documento listo para generar"
                        : "Requiere registrar el precio"}
                    </span>
                  </div>
                  <Download size={16} className="prep-gen-dl" />
                </button>

                <button
                  className="prep-gen-btn"
                  onClick={() => handleGenerar("programacion")}
                  disabled={!fechaValida || generando === "programacion"}
                >
                  <div className="prep-gen-icon">
                    {generando === "programacion" ? <Loader size={18} className="spin" /> : <Calendar size={18} />}
                  </div>
                  <div className="prep-gen-info">
                    <span className="prep-gen-title">Generar Carta de Programacion</span>
                    <span className="prep-gen-desc">
                      {fechaValida
                        ? `Programado para: ${formatFechaLarga(fechaProgramacion)}`
                        : "Requiere seleccionar fecha"}
                    </span>
                  </div>
                  <Download size={16} className="prep-gen-dl" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: Calendario */}
        <div className="prep-col-calendar">
          <div className="prep-card prep-card-calendar">
            <div className="prep-card-header">
              <span className="prep-card-title">Calendario de programacion</span>
            </div>
            <div className="prep-card-body">
              <MiniCalendario
                anio={calAnio}
                mes={calMes}
                fechasOcupadas={fechasOcupadas}
                fechaSeleccionada={fechaProgramacion}
                expedienteId={parseInt(id)}
                onSelect={handleSelectFecha}
                onPrevMonth={() => {
                  if (calMes === 1) { setCalMes(12); setCalAnio(calAnio - 1); }
                  else setCalMes(calMes - 1);
                }}
                onNextMonth={() => {
                  if (calMes === 12) { setCalMes(1); setCalAnio(calAnio + 1); }
                  else setCalMes(calMes + 1);
                }}
              />
              {/* Leyenda */}
              <div className="cal-legend">
                <span className="cal-legend-item">
                  <span className="cal-dot cal-dot-occupied"></span> Fecha ocupada
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot cal-dot-selected"></span> Fecha seleccionada
                </span>
                <span className="cal-legend-item">
                  <span className="cal-dot cal-dot-today"></span> Hoy
                </span>
              </div>

              {/* Lista de fechas del mes */}
              {fechasOcupadas.length > 0 && (
                <div className="cal-scheduled">
                  <span className="cal-scheduled-title">Servicios programados este mes</span>
                  {fechasOcupadas.map((f) => (
                    <div key={f.id} className="cal-scheduled-item">
                      <span className="cal-sched-date">
                        {f.fecha_programacion?.split("T")[0]}
                      </span>
                      <span className="cal-sched-client">
                        {f.cliente || "Sin cliente"} {f.nis ? `(${f.nis})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  Componente: Mini Calendario
// ══════════════════════════════════════════

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEMANA = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function MiniCalendario({ anio, mes, fechasOcupadas, fechaSeleccionada, expedienteId, onSelect, onPrevMonth, onNextMonth }) {
  const primerDia = new Date(anio, mes - 1, 1);
  const ultimoDia = new Date(anio, mes, 0);
  const diasEnMes = ultimoDia.getDate();

  // Lunes = 0, Domingo = 6
  let startDay = primerDia.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const todayStr = new Date().toISOString().split("T")[0];

  const celdas = [];
  // Celdas vacias antes del primer dia
  for (let i = 0; i < startDay; i++) {
    celdas.push(<div key={`empty-${i}`} className="cal-cell cal-cell-empty"></div>);
  }

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const isToday = fecha === todayStr;
    const isSelected = fecha === fechaSeleccionada;
    const ocupadaPor = fechasOcupadas.find(
      (f) => f.fecha_programacion?.split("T")[0] === fecha
    );
    const isOccupied = ocupadaPor && ocupadaPor.id !== expedienteId;
    const isOwn = ocupadaPor && ocupadaPor.id === expedienteId;
    const isPast = fecha < todayStr;

    let className = "cal-cell";
    if (isToday) className += " cal-today";
    if (isSelected) className += " cal-selected";
    if (isOccupied) className += " cal-occupied";
    if (isOwn) className += " cal-own";
    if (isPast) className += " cal-past";

    celdas.push(
      <div
        key={dia}
        className={className}
        onClick={() => !isPast && onSelect(fecha)}
        title={
          isOccupied
            ? `Ocupado: ${ocupadaPor.cliente || ""} (NIS: ${ocupadaPor.nis || "N/A"})`
            : isOwn
            ? "Este expediente"
            : ""
        }
      >
        <span className="cal-day-num">{dia}</span>
        {isOccupied && <span className="cal-cell-dot"></span>}
      </div>
    );
  }

  return (
    <div className="mini-calendar">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={onPrevMonth}>
          <ChevronLeft size={16} />
        </button>
        <span className="cal-nav-title">{MESES[mes - 1]} {anio}</span>
        <button className="cal-nav-btn" onClick={onNextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="cal-weekdays">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {celdas}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  Componentes auxiliares
// ══════════════════════════════════════════

function ReadonlyField({ label, value, mono }) {
  return (
    <div className="prep-ro-field">
      <span className="prep-ro-label">{label}</span>
      <span className={`prep-ro-value ${mono ? "mono" : ""}`}>{value || "--"}</span>
    </div>
  );
}

function formatFechaLarga(fechaStr) {
  if (!fechaStr) return "";
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const d = new Date(fechaStr + "T12:00:00");
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}
