/**
 * Servicio de autenticación.
 *
 * Capa de negocio: gestiona la lógica de login, generación de tokens
 * y consultas a la base de datos relacionadas con autenticación.
 *
 * Flujo: Controller → Service → Database
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

const SALT_ROUNDS = 10;

/**
 * Autentica un usuario por correo y contraseña.
 * @param {string} correo
 * @param {string} password
 * @returns {Object} { token, usuario }
 * @throws {Error} Si las credenciales son inválidas
 */
async function login(correo, password) {
  // Buscar usuario por correo
  const result = await query(
    "SELECT id, nombre, correo, password_hash, rol, activo FROM usuarios WHERE correo = $1",
    [correo]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Credenciales inválidas"), { status: 401 });
  }

  const usuario = result.rows[0];

  // Verificar que la cuenta esté activa
  if (!usuario.activo) {
    throw Object.assign(new Error("Cuenta desactivada"), { status: 403 });
  }

  // Verificar contraseña
  const passwordValid = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordValid) {
    throw Object.assign(new Error("Credenciales inválidas"), { status: 401 });
  }

  // Generar JWT
  const token = jwt.sign(
    {
      id: usuario.id,
      correo: usuario.correo,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

  // Actualizar último acceso
  await query("UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1", [
    usuario.id,
  ]);

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'login', 'usuarios', $1)`,
    [usuario.id]
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    },
  };
}

/**
 * Obtiene el perfil de un usuario por ID.
 * @param {number} id
 * @returns {Object} Datos del usuario (sin password)
 */
async function getProfile(id) {
  const result = await query(
    `SELECT id, nombre, correo, rol, activo, ultimo_acceso, creado_en 
     FROM usuarios WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }

  return result.rows[0];
}

/**
 * Crea un nuevo usuario (solo administradores).
 * @param {Object} data - { nombre, correo, password, rol }
 * @returns {Object} Usuario creado (sin password)
 */
async function createUser({ nombre, correo, password, rol }) {
  // Verificar si el correo ya existe
  const exists = await query("SELECT id FROM usuarios WHERE correo = $1", [
    correo,
  ]);
  if (exists.rows.length > 0) {
    throw Object.assign(new Error("El correo ya está registrado"), {
      status: 409,
    });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, nombre, correo, rol, activo, creado_en`,
    [nombre, correo, hash, rol]
  );

  return result.rows[0];
}

module.exports = { login, getProfile, createUser };
