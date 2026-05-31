/**
 * Agregador de rutas.
 */

const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");
const processRoutes = require("./process.routes");
const expedienteRoutes = require("./expediente.routes");
const evidenciasRoutes = require("./evidencias.routes");
const statsRoutes = require("./stats.routes");
const usersRoutes = require("./users.routes");
const notificationsRoutes = require("./notifications.routes");
const arcoRoutes = require("./arco.routes");
const prepararServicioRoutes = require("./preparar-servicio.routes");
const auditoriaRoutes = require("./auditoria.routes");

function registerRoutes(app) {
  app.use("/api/auth", authRoutes);
  app.use("/api/documentos", documentRoutes);
  app.use("/api/procesar", processRoutes);
  app.use("/api/expedientes", expedienteRoutes);
  app.use("/api/evidencias", evidenciasRoutes);   // HU-11
  app.use("/api/servicio", prepararServicioRoutes); // HU-16
  app.use("/api/stats", statsRoutes);
  app.use("/api/usuarios", usersRoutes);
  app.use("/api/notificaciones", notificationsRoutes);
  app.use("/api/arco", arcoRoutes);
  app.use("/api/auditoria", auditoriaRoutes);
}

module.exports = registerRoutes;
