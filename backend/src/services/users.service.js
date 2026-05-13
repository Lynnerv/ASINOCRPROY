/**
 * Servicio de usuarios (admin only).
 *
 * CRUD de usuarios del sistema.
 */

const bcrypt = require("bcrypt");
const { query } = require("../config/database");

async function listUsers() {
  const result = await query(
    `SELECT id, nombre, correo, rol, activo, ultimo_acceso, creado_en
     FROM usuarios ORDER BY creado_en DESC`
  );
  return result.rows;
}

async function createUser({ nombre, correo, password, rol }) {
  // Verificar correo único
  const existing = await query("SELECT id FROM usuarios WHERE correo = $1", [correo]);
  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Ya existe un usuario con ese correo"), { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, correo, rol, activo, creado_en`,
    [nombre, correo, hash, rol]
  );
  return result.rows[0];
}

async function updateUser(id, { nombre, correo, rol, activo }) {
  const result = await query(
    `UPDATE usuarios SET
       nombre = COALESCE($2, nombre),
       correo = COALESCE($3, correo),
       rol = COALESCE($4, rol),
       activo = COALESCE($5, activo),
       actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, nombre, correo, rol, activo`,
    [id, nombre, correo, rol, activo]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }
  return result.rows[0];
}

async function resetPassword(id, newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    "UPDATE usuarios SET password_hash = $2, actualizado_en = NOW() WHERE id = $1",
    [id, hash]
  );
}

module.exports = { listUsers, createUser, updateUser, resetPassword, getProfile, updateProfile, changePassword };

async function getProfile(userId) {
  const result = await query(
    `SELECT id, nombre, correo, rol, activo, ultimo_acceso, creado_en
     FROM usuarios WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }
  return result.rows[0];
}

async function updateProfile(userId, { nombre, correo }) {
  if (correo) {
    const existing = await query(
      "SELECT id FROM usuarios WHERE correo = $1 AND id != $2",
      [correo, userId]
    );
    if (existing.rows.length > 0) {
      throw Object.assign(new Error("Ya existe otro usuario con ese correo"), { status: 409 });
    }
  }

  const result = await query(
    `UPDATE usuarios SET
       nombre = COALESCE($2, nombre),
       correo = COALESCE($3, correo),
       actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, nombre, correo, rol`,
    [userId, nombre || null, correo || null]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }
  return result.rows[0];
}

async function changePassword(userId, currentPassword, newPassword) {
  const result = await query(
    "SELECT password_hash FROM usuarios WHERE id = $1",
    [userId]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
  if (!valid) {
    throw Object.assign(new Error("La contrasena actual es incorrecta"), { status: 400 });
  }

  if (newPassword.length < 6) {
    throw Object.assign(new Error("La nueva contrasena debe tener al menos 6 caracteres"), { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    "UPDATE usuarios SET password_hash = $2, actualizado_en = NOW() WHERE id = $1",
    [userId, hash]
  );
}
