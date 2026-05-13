import { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, DollarSign, Calendar,
  Loader, CheckCircle, AlertCircle,
} from "lucide-react";
import { servicioApi } from "../api/prepararServicio";
import "../styles/servicio-drawer.css";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

export default function ServicioDrawer({ open, expedienteId, currentPrecio, currentFecha, onClose, onSaved }) {
  const today = new Date();
  const [precio, setPrecio] = useState("");
  const [fechaProgramacion, setFechaProgramacion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [calAnio, setCalAnio] = useState(today.getFullYear());
  const [calMes, setCalMes] = useState(today.getMonth() + 1);
  const [fechasOcupadas, setFechasOcupadas] = useState([]);

  useEffect(() => {
    if (open) {
      setPrecio(currentPrecio || "");
      setFechaProgramacion(currentFecha ? currentFecha.split("T")[0] : "");
      setError(null);
    }
  }, [open, currentPrecio, currentFecha]);

  useEffect(() => {
    if (!open || !expedienteId) return;
    loadCalendario();
  }, [open, calAnio, calMes]);

  async function loadCalendario() {
    try {
      const { data } = await servicioApi.getCalendario(calAnio, calMes);
      setFechasOcupadas(data.servicios || []);
    } catch {}
  }

  async function handleSave() {
    if (!precio && !fechaProgramacion) {
      setError("Ingrese al menos el precio o la fecha");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const datos = {};
      if (precio) datos.precio_servicio = parseFloat(precio);
      if (fechaProgramacion) datos.fecha_programacion = fechaProgramacion;
      await servicioApi.updateDatos(expedienteId, datos);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    if (calMes === 1) { setCalMes(12); setCalAnio(calAnio - 1); }
    else setCalMes(calMes - 1);
  }

  function nextMonth() {
    if (calMes === 12) { setCalMes(1); setCalAnio(calAnio + 1); }
    else setCalMes(calMes + 1);
  }

  function formatFechaLarga(fechaStr) {
    if (!fechaStr) return "";
    const d = new Date(fechaStr + "T12:00:00");
    return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  }

  if (!open) return null;

  const primerDia = new Date(calAnio, calMes - 1, 1);
  const diasEnMes = new Date(calAnio, calMes, 0).getDate();
  let startDay = primerDia.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const todayStr = today.toISOString().split("T")[0];

  return (
    <>
      <div className="sd-overlay" onClick={onClose}></div>
      <div className="sd-drawer">
        <div className="sd-header">
          <h3>Preparar servicio</h3>
          <button className="sd-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sd-body">
          <div className="sd-field">
            <label>Precio del servicio (sin IGV)</label>
            <div className="sd-input-wrap">
              <span className="sd-input-prefix">S/.</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="sd-field">
            <label>Fecha de programacion</label>
            {fechaProgramacion && (
              <span className="sd-fecha-text">{formatFechaLarga(fechaProgramacion)}</span>
            )}
          </div>

          <div className="sd-calendar">
            <div className="sd-cal-nav">
              <button onClick={prevMonth}><ChevronLeft size={16} /></button>
              <span>{MESES[calMes - 1]} {calAnio}</span>
              <button onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
            <div className="sd-cal-weekdays">
              {DIAS_SEMANA.map((d) => <div key={d} className="sd-cal-wd">{d}</div>)}
            </div>
            <div className="sd-cal-grid">
              {Array.from({ length: startDay }, (_, i) => (
                <div key={`e-${i}`} className="sd-cal-cell sd-cal-empty"></div>
              ))}
              {Array.from({ length: diasEnMes }, (_, i) => {
                const dia = i + 1;
                const fecha = `${calAnio}-${String(calMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const isToday = fecha === todayStr;
                const isSelected = fecha === fechaProgramacion;
                const ocupada = fechasOcupadas.find((f) => f.fecha_programacion?.split("T")[0] === fecha);
                const isOccupied = ocupada && ocupada.id !== expedienteId;
                const isPast = fecha < todayStr;

                let cls = "sd-cal-cell";
                if (isToday) cls += " sd-cal-today";
                if (isSelected) cls += " sd-cal-selected";
                if (isOccupied) cls += " sd-cal-occupied";
                if (isPast) cls += " sd-cal-past";

                return (
                  <div key={dia} className={cls}
                    onClick={() => !isPast && !isOccupied && setFechaProgramacion(fecha)}
                    title={isOccupied ? `Ocupado: ${ocupada.cliente || ""}` : ""}>
                    <span>{dia}</span>
                    {isOccupied && <span className="sd-cal-dot"></span>}
                  </div>
                );
              })}
            </div>
            <div className="sd-cal-legend">
              <span><span className="sd-legend-dot sd-dot-occupied"></span> Ocupada</span>
              <span><span className="sd-legend-dot sd-dot-selected"></span> Seleccionada</span>
              <span><span className="sd-legend-dot sd-dot-today"></span> Hoy</span>
            </div>
          </div>

          {error && (
            <div className="sd-error"><AlertCircle size={14} /> {error}</div>
          )}
        </div>

        <div className="sd-footer">
          <button className="btn btn-primary sd-save" onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
            Guardar datos del servicio
          </button>
        </div>
      </div>
    </>
  );
}
