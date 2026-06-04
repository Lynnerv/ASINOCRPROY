/**
 * Rutas de documentos.
 *
 * POST /api/documentos/cargar   → Subir cartas (HU-04)
 * GET  /api/documentos          → Listar documentos
 * GET  /api/documentos/:id      → Detalle de un documento
 */

const { Router } = require("express");

const documentController = require("../controllers/document.controller");
const auth = require("../middlewares/auth.middleware");
const { upload } = require("../config/upload");

const router = Router();

// Todas las rutas requieren autenticación
router.use(auth);

// --- Subir cartas (HU-04) ---
router.post(
  "/cargar",
  upload.array("cartas", 20),
  documentController.handleMulterError,
  documentController.uploadFiles
);

// --- Listar documentos ---
router.get("/", documentController.listDocuments);

// --- Detalle de un documento ---
router.get("/:id", documentController.getDocument);

router.get("/:id/imagen", async (req, res, next) => {
  try {
    const { query: dbQuery } = require("../config/database");
    const result = await dbQuery("SELECT ruta_archivo, tipo_archivo FROM documentos WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Documento no encontrado" });

    const { ruta_archivo, tipo_archivo } = result.rows[0];

    if (ruta_archivo.startsWith("documentos/")) {
      const { downloadFile } = require("../config/storage");
      const buffer = await downloadFile("documentos", ruta_archivo);
      const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
      res.setHeader("Content-Type", mimeMap[tipo_archivo] || "image/jpeg");
      res.send(buffer);
    } else {
      const path = require("path");
      const absPath = path.resolve(process.cwd(), ruta_archivo);
      res.sendFile(absPath);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
