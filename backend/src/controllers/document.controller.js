/**
 * Controlador de documentos.
 *
 * Endpoints:
 *   POST /api/documentos/cargar        → Subir (HU-04)
 *   GET  /api/documentos              → Listar (HU-08)
 *   GET  /api/documentos/:id           → Detalle (HU-09)
 *   GET  /api/documentos/:id/archivo   → Blob/Descarga (HU-09)
 */

const documentService = require("../services/document.service");
const { MAX_FILE_SIZE } = require("../config/upload");
const path = require("path");
const fs = require("fs");

/**
 * POST /api/documentos/cargar
 */
async function uploadFiles(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: "No se recibieron archivos. Seleccione al menos una carta.",
      });
    }

    const { expediente_id, documentos } = await documentService.registerUploadedFiles(
      req.files,
      req.usuario.id
    );

    const exitosos = documentos.filter((r) => r.resultado === "registrado").length;
    const errores = documentos.filter((r) => r.resultado === "error").length;

    res.status(201).json({
      mensaje: `Carga finalizada con éxito. Se procesaron ${exitosos} cartas.`,
      expediente_id,
      total: req.files.length,
      exitosos,
      errores,
      documentos,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documentos
 * Query params:
 *  - page, limit
 *  - estado
 *  - buscar
 *  - nis, cliente, tipo
 *  - fecha_inicio, fecha_fin
 */
async function listDocuments(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const estado = req.query.estado || null;
    const buscar = req.query.buscar || null;

    const nis = req.query.nis || null;
    const cliente = req.query.cliente || null;
    const tipo = req.query.tipo || null;

    const fechaInicio = req.query.fecha_inicio || null;
    const fechaFin = req.query.fecha_fin || null;

    const data = await documentService.listDocuments({
      page,
      limit,
      estado,
      buscar,
      nis,
      cliente,
      tipo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });

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
    const doc = await documentService.getDocumentById(parseInt(req.params.id));
    res.json({ documento: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documentos/:id/archivo
 * - Si ?download=1 => fuerza descarga (nombre estandarizado)
 * - Si no => sendFile (preview)
 */
async function getDocumentFile(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const info = await documentService.getDocumentFileInfo(id);

    const absolutePath = path.resolve(process.cwd(), info.ruta_archivo);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "Archivo no encontrado en el servidor" });
    }

    const ext =
      (info.tipo_archivo ||
        path.extname(info.nombre_archivo || "").replace(".", "") ||
        "bin").toLowerCase();

    const downloadName = `documento_${id}.${ext}`;
    const download = String(req.query.download || "") === "1";

    if (download) {
      return res.download(absolutePath, downloadName);
    }
    return res.sendFile(absolutePath);
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware para manejar errores de Multer.
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

module.exports = {
  uploadFiles,
  listDocuments,
  getDocument,
  getDocumentFile,
  handleMulterError,
};