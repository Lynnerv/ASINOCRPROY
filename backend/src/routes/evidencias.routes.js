/**
 * Rutas de Evidencias del Expediente (HU-11).
 *
 *   GET    /api/evidencias/:expedienteId             → Listar evidencias del expediente
 *   POST   /api/evidencias/:expedienteId/upload      → Subir/reemplazar archivo
 *   DELETE /api/evidencias/evidencia/:evidenciaId    → Eliminar archivo
 *   PATCH  /api/evidencias/:expedienteId/factura     → Actualizar N° de factura
 *   POST   /api/evidencias/:expedienteId/guardar     → Validar y marcar como completado
 */

const { Router } = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const auth = require("../middlewares/auth.middleware");
const evidenciasService = require("../services/evidencias.service");

const router = Router();

// ── Configuración de Multer ─────────────────────────────────────────

const fileFilter = (req, file, cb) => {
  const tipo = req.body.tipo;
  if (!tipo) {
    return cb(new Error("Falta el campo 'tipo' en la solicitud"), false);
  }

  if (tipo === "informe_laboratorio") {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("El informe de laboratorio debe ser un archivo PDF"), false);
    }
  } else if (tipo === "foto_inoculacion" || tipo === "foto_monitoreo") {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.mimetype)) {
      return cb(new Error("Las fotos deben ser JPG o PNG"), false);
    }
  } else {
    return cb(new Error(`Tipo inválido: ${tipo}`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ── Rutas ────────────────────────────────────────────────────────────

// Obtener evidencias de un expediente
router.get("/:expedienteId", auth, async (req, res, next) => {
  try {
    const data = await evidenciasService.getEvidencias(parseInt(req.params.expedienteId));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Subir / reemplazar una evidencia
router.post("/:expedienteId/upload", auth, (req, res, next) => {
  upload.single("archivo")(req, res, async (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? "El archivo excede el límite de 5 MB"
          : err.message;
      return res.status(400).json({ error: msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ningún archivo" });
    }

    try {
      const evidencia = await evidenciasService.addOrReplaceEvidencia({
        expedienteId: parseInt(req.params.expedienteId),
        tipo: req.body.tipo,
        orden: req.body.orden,
        file: req.file,
        userId: req.usuario.id,
      });
      res.json({ evidencia });
    } catch (err2) {
      next(err2);
    }
  });
});

// Eliminar una evidencia individual
router.delete("/evidencia/:evidenciaId", auth, async (req, res, next) => {
  try {
    const result = await evidenciasService.deleteEvidencia(parseInt(req.params.evidenciaId));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Actualizar N° de factura
router.patch("/:expedienteId/factura", auth, async (req, res, next) => {
  try {
    const { numero_factura } = req.body;
    const result = await evidenciasService.updateNumeroFactura(
      parseInt(req.params.expedienteId),
      numero_factura
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Guardar evidencias (validar todo y cambiar estado del expediente)
router.post("/:expedienteId/guardar", auth, async (req, res, next) => {
  try {
    const result = await evidenciasService.guardarEvidencias(
      parseInt(req.params.expedienteId),
      req.usuario.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Reordenar evidencias de un tipo
router.patch("/:expedienteId/reorder", auth, async (req, res, next) => {
  try {
    const { tipo, ids } = req.body;
    const result = await evidenciasService.reorderEvidencias(
      parseInt(req.params.expedienteId),
      tipo,
      ids
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
