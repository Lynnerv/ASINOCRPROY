/**
 * Controlador de documentos.
 *
 * Endpoints:
 *   POST /api/documentos/cargar  → Subir cartas (HU-04)
 *   GET  /api/documentos         → Listar documentos
 *   GET  /api/documentos/:id     → Detalle de un documento
 */

const documentService = require("../services/document.service");
const { MAX_FILE_SIZE } = require("../config/upload");

/**
 * POST /api/documentos/cargar
 * Multipart form-data: campo "cartas" con uno o varios archivos.
 */
async function uploadFiles(req, res, next) {
  try {
    // Multer ya procesó los archivos; si hubo error de Multer, viene por middleware
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No se recibieron archivos. Seleccione al menos una carta.",
      });
    }

    const results = await documentService.registerUploadedFiles(
      req.files,
      req.usuario.id
    );

    const exitosos = results.filter((r) => r.resultado === "registrado").length;
    const errores = results.filter((r) => r.resultado === "error").length;

    res.status(201).json({
      mensaje: `Carga finalizada con éxito. Se procesaron ${exitosos} cartas.`,
      total: req.files.length,
      exitosos,
      errores,
      documentos: results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documentos
 * Query params: page, limit, estado
 */
async function listDocuments(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const estado = req.query.estado || null;

    const data = await documentService.listDocuments({ page, limit, estado });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documentos/:id
 */
async function getDocument(req, res, next) {
  try {
    const doc = await documentService.getDocumentById(
      parseInt(req.params.id)
    );
    res.json({ documento: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware para manejar errores específicos de Multer.
 * Se coloca después del upload middleware en la ruta.
 */
function handleMulterError(err, _req, res, next) {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: `Error al subir. El archivo excede el límite de ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
    });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      error: "Error al subir. Se excedió el límite de 20 archivos por carga.",
    });
  }
  if (err.status === 400) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

module.exports = { uploadFiles, listDocuments, getDocument, handleMulterError };
