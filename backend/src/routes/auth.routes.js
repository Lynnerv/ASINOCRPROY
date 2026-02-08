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

module.exports = router;
