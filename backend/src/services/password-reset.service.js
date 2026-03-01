/**
 * Servicio de recuperación de contraseña (HU-02).
 *
 * Flujo:
 *   1. Usuario solicita recuperación → genera token + envía email
 *   2. Usuario hace clic en el enlace → valida token (1 hora)
 *   3. Usuario envía nueva contraseña → actualiza y limpia token
 *
 * Política de contraseña:
 *   - Mínimo 8 caracteres
 *   - Al menos 1 número
 *   - Al menos 1 mayúscula
 *
 * Seguridad:
 *   - Token aleatorio de 64 caracteres (crypto.randomBytes)
 *   - Expira en 1 hora
 *   - Se elimina después de usar
 *   - No revela si el correo existe o no (misma respuesta siempre)
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { query } = require("../config/database");
const { sendPasswordResetEmail } = require("./email.service");

const TOKEN_EXPIRY_HOURS = 1;
const SALT_ROUNDS = 10;

/**
 * Valida la política de contraseña.
 * @returns {string|null} Mensaje de error o null si cumple
 */
function validatePasswordPolicy(password) {
  if (!password || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres";
  }
  if (!/[A-Z]/.test(password)) {
    return "La contraseña debe contener al menos una letra mayúscula";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe contener al menos un número";
  }
  return null;
}

/**
 * Solicita recuperación de contraseña.
 * Genera token, lo guarda en BD, y envía email.
 *
 * SIEMPRE responde con éxito para no revelar si el correo existe.
 */
async function requestReset(correo) {
  // Buscar usuario
  const result = await query(
    "SELECT id, nombre, correo, activo FROM usuarios WHERE correo = $1",
    [correo]
  );

  // Si no existe o está inactivo, responder igual (seguridad)
  if (result.rows.length === 0 || !result.rows[0].activo) {
    return { sent: true }; // No revelar que el correo no existe
  }

  const usuario = result.rows[0];

  // Generar token seguro
  const token = crypto.randomBytes(32).toString("hex");

  // Guardar token en BD (expira calculada por PostgreSQL para evitar desfase de timezone)
  await query(
    `UPDATE usuarios 
     SET reset_token = $2, 
         reset_token_expira = NOW() + INTERVAL '1 hour',
         actualizado_en = NOW()
     WHERE id = $1`,
    [usuario.id, token]
  );

  // Enviar email
  try {
    await sendPasswordResetEmail(usuario.correo, token);
  } catch (err) {
    console.error("[PasswordReset] Error enviando email:", err.message);
    // No fallar la solicitud por error de email
  }

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'solicitud_reset', 'usuarios', $1)`,
    [usuario.id]
  );

  return { sent: true };
}

/**
 * Verifica si un token de recuperación es válido.
 */
async function verifyToken(token) {
  if (!token) return { valid: false };

  const result = await query(
    `SELECT id, nombre, correo 
     FROM usuarios 
     WHERE reset_token = $1 
       AND reset_token_expira > NOW()
       AND activo = true`,
    [token]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  return {
    valid: true,
    usuario: {
      id: result.rows[0].id,
      nombre: result.rows[0].nombre,
      correo: result.rows[0].correo,
    },
  };
}

/**
 * Restablece la contraseña usando un token válido.
 */
async function resetPassword(token, newPassword) {
  // Validar política
  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    throw Object.assign(new Error(policyError), { status: 400 });
  }

  // Verificar token
  const { valid, usuario } = await verifyToken(token);
  if (!valid) {
    throw Object.assign(
      new Error("El enlace de recuperación es inválido o ha expirado"),
      { status: 400 }
    );
  }

  // Hash nueva contraseña
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  // Actualizar contraseña y limpiar token
  await query(
    `UPDATE usuarios SET
       password_hash = $2,
       reset_token = NULL,
       reset_token_expira = NULL,
       actualizado_en = NOW()
     WHERE id = $1`,
    [usuario.id, hash]
  );

  // Registrar en historial
  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'reset_password', 'usuarios', $1)`,
    [usuario.id]
  );

  return { success: true, correo: usuario.correo };
}

module.exports = {
  validatePasswordPolicy,
  requestReset,
  verifyToken,
  resetPassword,
};
