/**
 * Agregador de rutas.
 *
 * Registra todos los módulos de rutas en la aplicación Express.
 * A medida que se agreguen módulos (expedientes, documentos, etc.)
 * se registran aquí.
 */

const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");
const processRoutes = require("./process.routes");
const expedienteRoutes = require("./expediente.routes");

function registerRoutes(app) {
  app.use("/api/auth", authRoutes);
  app.use("/api/documentos", documentRoutes);
  app.use("/api/procesar", processRoutes);
  app.use("/api/expedientes", expedienteRoutes);
}

module.exports = registerRoutes;
