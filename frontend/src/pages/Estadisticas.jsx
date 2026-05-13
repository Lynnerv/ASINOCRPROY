import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Loader, Download, Calendar, FileText, CheckCircle,
  Clock, DollarSign, Users,
} from "lucide-react";
import { statsApi } from "../api/documents";
import "../styles/estadisticas.css";

const ESTADO_COLORES = {
  pendiente: "#94a3b8",
  procesado: "#60a5fa",
  en_revision: "#fbbf24",
  completo: "#34d399",
  servicio_programado: "#a78bfa",
  evidencias_cargadas: "#f472b6",
  listo_para_generar: "#2dd4bf",
  generado: "#22c55e",
  cerrado: "#6b7280",
};

const ESTADO_LABELS = {
  pendiente: "Pendiente",
  procesado: "Procesado",
  en_revision: "En revision",
  completo: "Completo",
  servicio_programado: "Programado",
  evidencias_cargadas: "Evidencias",
  listo_para_generar: "Listo",
  generado: "Generado",
  cerrado: "Cerrado",
};

const MESES_CORTOS = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Oct", "11": "Nov", "12": "Dic",
};

export default function Estadisticas() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData(overrideDesde, overrideHasta) {
    setLoading(true);
    try {
      const d = overrideDesde !== undefined ? overrideDesde : desde;
      const h = overrideHasta !== undefined ? overrideHasta : hasta;
      const { data: res } = await statsApi.getReportes(d || undefined, h || undefined);
      setData(res);
    } catch (err) {
      console.error("Error cargando estadisticas:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleFilter() {
    loadData();
  }

  function clearFilter() {
    setDesde("");
    setHasta("");
    loadData("", "");
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data: res } = await statsApi.getExportData(desde || undefined, hasta || undefined);
      const rows = res.expedientes || [];

      const headers = [
        "N Expediente", "Estado", "NIS", "Cliente", "Direccion", "Distrito",
        "Documentos", "Anexos", "Precio (S/.)", "Fecha Programacion", "Fecha Creacion",
      ];

      const csvRows = [headers.join(",")];
      for (const r of rows) {
        csvRows.push([
          r.expediente_id,
          r.estado,
          r.nis || "",
          `"${(r.cliente || "").replace(/"/g, '""')}"`,
          `"${(r.direccion || "").replace(/"/g, '""')}"`,
          r.distrito || "",
          r.num_documentos,
          `"${r.anexos || ""}"`,
          r.precio_servicio || "",
          r.fecha_programacion ? r.fecha_programacion.split("T")[0] : "",
          r.creado_en ? r.creado_en.split("T")[0] : "",
        ].join(","));
      }

      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Reporte_Expedientes_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando:", err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="est-page">
        <div className="est-loading"><Loader size={20} className="spin" /> Cargando estadisticas...</div>
      </div>
    );
  }

  if (!data) return null;

  const { resumen, porMes, porEstado, topClientes } = data;

  const mesData = porMes.map((m) => {
    const [y, mm] = m.mes.split("-");
    return { name: `${MESES_CORTOS[mm]} ${y.slice(2)}`, cantidad: m.cantidad };
  });

  const estadoData = porEstado.map((e) => ({
    name: ESTADO_LABELS[e.estado] || e.estado,
    value: e.cantidad,
    color: ESTADO_COLORES[e.estado] || "#94a3b8",
  }));

  return (
    <div className="est-page">
      <div className="est-header">
        <div>
          <h1>Estadisticas y reportes</h1>
          <p>Resumen del estado general de los expedientes</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader size={16} className="spin" /> : <Download size={16} />}
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="est-filters">
        <div className="est-filter-group">
          <label>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="est-filter-group">
          <label>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button className="btn btn-secondary est-filter-btn" onClick={handleFilter}>Aplicar</button>
        {(desde || hasta) && (
          <button className="btn btn-outline est-filter-btn" onClick={clearFilter}>Limpiar</button>
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="est-cards">
        <div className="est-card est-card-blue">
          <div className="est-card-icon"><FileText size={20} /></div>
          <div className="est-card-data">
            <span className="est-card-value">{resumen.total_expedientes}</span>
            <span className="est-card-label">Total expedientes</span>
          </div>
        </div>
        <div className="est-card est-card-green">
          <div className="est-card-icon"><CheckCircle size={20} /></div>
          <div className="est-card-data">
            <span className="est-card-value">{resumen.completados}</span>
            <span className="est-card-label">Completados</span>
          </div>
        </div>
        <div className="est-card est-card-yellow">
          <div className="est-card-icon"><Clock size={20} /></div>
          <div className="est-card-data">
            <span className="est-card-value">{resumen.en_proceso}</span>
            <span className="est-card-label">En proceso</span>
          </div>
        </div>
        <div className="est-card est-card-purple">
          <div className="est-card-icon"><DollarSign size={20} /></div>
          <div className="est-card-data">
            <span className="est-card-value">S/. {Number(resumen.ingreso_total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
            <span className="est-card-label">Ingreso total</span>
          </div>
        </div>
      </div>

      {/* Graficos */}
      <div className="est-charts">
        <div className="est-chart-card">
          <h3>Expedientes por mes</h3>
          {mesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                  }}
                />
                <Bar dataKey="cantidad" fill="#6366f1" radius={[4, 4, 0, 0]} name="Expedientes" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="est-empty">Sin datos para el periodo seleccionado</div>
          )}
        </div>

        <div className="est-chart-card">
          <h3>Distribucion por estado</h3>
          {estadoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={estadoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {estadoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "0.75rem" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="est-empty">Sin datos para el periodo seleccionado</div>
          )}
        </div>
      </div>

      {/* Top clientes */}
      <div className="est-chart-card">
        <h3>Clientes con mas expedientes</h3>
        {topClientes.length > 0 ? (
          <div className="est-table-wrapper">
            <table className="est-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>NIS</th>
                  <th>Expedientes</th>
                </tr>
              </thead>
              <tbody>
                {topClientes.map((c, i) => (
                  <tr key={i}>
                    <td>{c.cliente || "Sin nombre"}</td>
                    <td className="mono">{c.nis || "--"}</td>
                    <td><strong>{c.expedientes}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="est-empty">Sin clientes registrados</div>
        )}
      </div>
    </div>
  );
}
