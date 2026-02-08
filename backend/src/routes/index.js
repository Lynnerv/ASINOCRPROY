/**
 * Agregador de rutas.
 *
 * Registra todos los módulos de rutas en la aplicación Express.
 * A medida que se agreguen módulos (expedientes, documentos, etc.)
 * se registran aquí.
 */

const authRoutes = require("./auth.routes");

function registerRoutes(app) {
  app.use("/api/auth", authRoutes);

  // Futuras rutas:
  // app.use("/api/expedientes", expedientesRoutes);
  // app.use("/api/documentos", documentosRoutes);
}

module.exports = registerRoutes;
