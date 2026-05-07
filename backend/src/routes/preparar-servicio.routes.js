/**
 * Rutas de Preparar Servicio (HU-16).
 *
 *   GET    /api/servicio/:expedienteId          -> Datos del expediente para preparar servicio
 *   PATCH  /api/servicio/:expedienteId          -> Actualizar precio y/o fecha
 *   GET    /api/servicio/calendario/:anio/:mes  -> Fechas programadas del mes
 *   POST   /api/servicio/:expedienteId/proforma -> Generar proforma (.docx)
 *   POST   /api/servicio/:expedienteId/programacion -> Generar carta de programacion (.docx)
 */

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const service = require("../services/preparar-servicio.service");

const router = Router();

// Calendario mensual (DEBE ir antes de /:expedienteId para no confundir "calendario" con un ID)
router.get("/calendario/:anio/:mes", auth, async (req, res, next) => {
  try {
    const fechas = await service.getCalendario(
      parseInt(req.params.anio),
      parseInt(req.params.mes)
    );
    res.json({ fechas });
  } catch (err) {
    next(err);
  }
});

// Obtener datos del expediente
router.get("/:expedienteId", auth, async (req, res, next) => {
  try {
    const data = await service.getDatosServicio(parseInt(req.params.expedienteId));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Actualizar precio y/o fecha
router.patch("/:expedienteId", auth, async (req, res, next) => {
  try {
    const { precio_servicio, fecha_programacion } = req.body;
    const result = await service.updateDatosServicio(
      parseInt(req.params.expedienteId),
      { precio_servicio, fecha_programacion }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Generar proforma
router.post("/:expedienteId/proforma", auth, async (req, res, next) => {
  try {
    const { filename, buffer } = await service.generarProforma(parseInt(req.params.expedienteId));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Generar carta de programacion
router.post("/:expedienteId/programacion", auth, async (req, res, next) => {
  try {
    const { filename, buffer } = await service.generarProgramacion(parseInt(req.params.expedienteId));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
