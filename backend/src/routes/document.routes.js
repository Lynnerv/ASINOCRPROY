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

module.exports = router;
