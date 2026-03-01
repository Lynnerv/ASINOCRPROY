/**
 * Rutas de gestión de usuarios (solo admin).
 *
 * GET    /api/usuarios        → Listar usuarios
 * POST   /api/usuarios        → Crear usuario
 * PUT    /api/usuarios/:id    → Actualizar usuario
 * PATCH  /api/usuarios/:id/password → Reset password
 */

const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/role.middleware");
const usersService = require("../services/users.service");

const router = Router();

// Todas las rutas requieren admin
router.use(auth, authorize("administrador"));

router.get("/", async (req, res, next) => {
  try {
    const users = await usersService.listUsers();
    res.json({ usuarios: users });
  } catch (err) { next(err); }
});

router.post("/", async (req, res, next) => {
  try {
    const { nombre, correo, password, rol } = req.body;
    if (!nombre || !correo || !password || !rol) {
      return res.status(400).json({ error: "Todos los campos son requeridos" });
    }
    const user = await usersService.createUser({ nombre, correo, password, rol });
    res.status(201).json({ usuario: user });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const user = await usersService.updateUser(parseInt(req.params.id), req.body);
    res.json({ usuario: user });
  } catch (err) { next(err); }
});

router.patch("/:id/password", async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    await usersService.resetPassword(parseInt(req.params.id), password);
    res.json({ mensaje: "Contraseña actualizada" });
  } catch (err) { next(err); }
});

module.exports = router;
