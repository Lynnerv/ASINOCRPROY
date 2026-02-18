/**
 * Rutas de expedientes.
 *
 * Panel de control:
 *   GET    /api/expedientes/pendientes           → Expedientes con docs pendientes
 *   GET    /api/expedientes                      → Todos los expedientes
 *   POST   /api/expedientes                      → Crear expediente vacío
 *   DELETE /api/expedientes/documento/:id        → Eliminar documento
 *   PATCH  /api/expedientes/documento/:id/mover  → Mover documento
 *
 * HU-06 - Ver expedientes procesados:
 *   GET    /api/expedientes/procesados           → Lista paginada con filtros
 *   GET    /api/expedientes/:id/detalle          → Detalle completo (docs + VMA)
 */

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const expedienteService = require("../services/expediente.service");

const router = Router();

// ── HU-06: Expedientes procesados ──

// Lista paginada con filtros y búsqueda
router.get("/procesados", auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const estado = req.query.estado || null;
    const buscar = req.query.buscar || null;

    const data = await expedienteService.listProcessedExpedientes({
      page, limit, estado, buscar,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Detalle completo de un expediente (documentos + parámetros VMA)
router.get("/:id/detalle", auth, async (req, res, next) => {
  try {
    const expediente = await expedienteService.getExpedienteDetail(
      parseInt(req.params.id)
    );
    res.json({ expediente });
  } catch (err) {
    next(err);
  }
});

// ── Panel de control ──

// Listar expedientes con documentos pendientes (para panel de control)
router.get("/pendientes", auth, async (req, res, next) => {
  try {
    const expedientes = await expedienteService.listPendingExpedientes();
    res.json({ expedientes });
  } catch (err) {
    next(err);
  }
});

// Listar todos los expedientes (para selector de destino)
router.get("/", auth, async (req, res, next) => {
  try {
    const expedientes = await expedienteService.listAllExpedientes();
    res.json({ expedientes });
  } catch (err) {
    next(err);
  }
});

// Crear expediente vacío
router.post("/", auth, async (req, res, next) => {
  try {
    const exp = await expedienteService.createEmptyExpediente(req.usuario.id);
    res.status(201).json({ expediente: exp });
  } catch (err) {
    next(err);
  }
});

// Eliminar un documento
router.delete("/documento/:id", auth, async (req, res, next) => {
  try {
    const result = await expedienteService.deleteDocument(
      parseInt(req.params.id)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mover documento a otro expediente
router.patch("/documento/:id/mover", auth, async (req, res, next) => {
  try {
    const { expediente_destino_id } = req.body;
    if (!expediente_destino_id) {
      return res
        .status(400)
        .json({ error: "Se requiere expediente_destino_id" });
    }
    const result = await expedienteService.moveDocument(
      parseInt(req.params.id),
      parseInt(expediente_destino_id)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
