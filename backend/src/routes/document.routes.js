/**
 * Rutas de documentos.
 *
 * POST /api/documentos/cargar       → Subir (HU-04)
 * GET  /api/documentos             → Listar (HU-08)
 * GET  /api/documentos/:id/archivo  → Blob/Descarga (HU-09)
 * GET  /api/documentos/:id          → Detalle (HU-09)
 */

const { Router } = require("express");

const documentController = require("../controllers/document.controller");
const auth = require("../middlewares/auth.middleware");
const { upload } = require("../config/upload");

const router = Router();

// Todas requieren auth
router.use(auth);

// HU-04
router.post(
  "/cargar",
  upload.array("cartas", 20),
  documentController.handleMulterError,
  documentController.uploadFiles
);

// HU-08
router.get("/", documentController.listDocuments);

// HU-09 (archivo)
router.get("/:id/archivo", documentController.getDocumentFile);

// HU-09 (detalle)
router.get("/:id", documentController.getDocument);

module.exports = router;