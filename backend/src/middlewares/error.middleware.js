/**
 * Middleware global de manejo de errores.
 *
 * Captura cualquier error no manejado en controllers/services
 * y responde con un formato JSON consistente.
 *
 * Express lo identifica como error handler porque tiene 4 parámetros.
 */

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  // Log solo en desarrollo
  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR ${status}] ${message}`);
    if (status === 500) console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" &&
      status === 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
