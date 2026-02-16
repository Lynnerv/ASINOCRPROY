/**
 * Rutas de autenticación.
 *
 * POST /api/auth/login     → Iniciar sesión
 * GET  /api/auth/perfil    → Obtener perfil (requiere token)
 * POST /api/auth/usuarios  → Crear usuario (solo admin)
 */

const { Router } = require("express");
const { body } = require("express-validator");

const authController = require("../controllers/auth.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const passwordResetService = require("../services/password-reset.service");

const router = Router();

// --- Login (público) ---
router.post(
  "/login",
  [
    body("correo")
      .isEmail()
      .withMessage("Debe ser un correo electrónico válido")
      .normalizeEmail(),
    body("password")
      .notEmpty()
      .withMessage("La contraseña es requerida"),
    validate,
  ],
  authController.login
);

// --- Perfil (autenticado) ---
router.get("/perfil", auth, authController.getProfile);

// --- Crear usuario (solo admin) ---
router.post(
  "/usuarios",
  auth,
  authorize("administrador"),
  [
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre es requerido")
      .isLength({ max: 100 })
      .withMessage("El nombre no debe exceder 100 caracteres"),
    body("correo")
      .isEmail()
      .withMessage("Debe ser un correo electrónico válido")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    body("rol")
      .isIn(["administrador", "operador"])
      .withMessage('El rol debe ser "administrador" o "operador"'),
    validate,
  ],
  authController.createUser
);

// --- Recuperar contraseña (HU-02) ---

// Paso 1: Solicitar enlace de recuperación
router.post(
  "/recuperar",
  [
    body("correo")
      .isEmail()
      .withMessage("Debe ser un correo electrónico válido")
      .normalizeEmail(),
    validate,
  ],
  async (req, res, next) => {
    try {
      await passwordResetService.requestReset(req.body.correo);
      // Siempre responder éxito (no revelar si el correo existe)
      res.json({
        mensaje:
          "Si el correo está registrado, recibirás un enlace de recuperación.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// Paso 2: Verificar token (cuando el usuario abre el enlace)
router.get("/verificar-token/:token", async (req, res, next) => {
  try {
    const result = await passwordResetService.verifyToken(req.params.token);
    if (!result.valid) {
      return res.status(400).json({
        valid: false,
        error: "El enlace de recuperación es inválido o ha expirado.",
      });
    }
    res.json({ valid: true, nombre: result.usuario.nombre });
  } catch (err) {
    next(err);
  }
});

// Paso 3: Restablecer contraseña
router.post(
  "/restablecer",
  [
    body("token").notEmpty().withMessage("Token requerido"),
    body("password").notEmpty().withMessage("La contraseña es requerida"),
    validate,
  ],
  async (req, res, next) => {
    try {
      const result = await passwordResetService.resetPassword(
        req.body.token,
        req.body.password
      );
      res.json({
        mensaje: "Contraseña actualizada exitosamente.",
        correo: result.correo,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
