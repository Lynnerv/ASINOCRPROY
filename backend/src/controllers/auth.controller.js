/**
 * Controlador de autenticación.
 *
 * Capa HTTP: recibe requests, delega lógica al servicio,
 * y devuelve responses con formato consistente.
 *
 * Flujo: Route → Controller → Service → Database
 */

const authService = require("../services/auth.service");

/**
 * POST /api/auth/login
 * Body: { correo, password }
 */
async function login(req, res, next) {
  try {
    const { correo, password } = req.body;
    const result = await authService.login(correo, password);

    res.json({
      mensaje: "Inicio de sesión exitoso",
      token: result.token,
      usuario: result.usuario,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/perfil
 * Headers: Authorization: Bearer <token>
 */
async function getProfile(req, res, next) {
  try {
    const usuario = await authService.getProfile(req.usuario.id);
    res.json({ usuario });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/usuarios
 * Body: { nombre, correo, password, rol }
 * Solo administradores.
 */
async function createUser(req, res, next) {
  try {
    const usuario = await authService.createUser(req.body);
    res.status(201).json({
      mensaje: "Usuario creado exitosamente",
      usuario,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, getProfile, createUser };
