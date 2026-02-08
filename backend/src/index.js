/**
 * Punto de entrada del servidor Express.
 *
 * Arquitectura por capas:
 *   Routes → Controllers → Services → Database
 *
 * Responsabilidades:
 *   - Cargar variables de entorno
 *   - Configurar middlewares globales
 *   - Registrar rutas
 *   - Manejar errores centralizadamente
 *   - Iniciar servidor
 */

require("dotenv").config({ override: true });

const express = require("express");
const cors = require("cors");

const registerRoutes = require("./routes");
const errorHandler = require("./middlewares/error.middleware");

const app = express();

// --- Middlewares globales ---
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --- Health check ---
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    project: "ASIN-OCR",
    timestamp: new Date().toISOString(),
  });
});

// --- Rutas ---
registerRoutes(app);

// --- 404 ---
app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// --- Error handler global ---
app.use(errorHandler);

// --- Iniciar servidor ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  ASIN-OCR Backend`);
  console.log(`  Puerto: ${PORT}`);
  console.log(`  Entorno: ${process.env.NODE_ENV || "development"}\n`);
});

module.exports = app;