const { query } = require("../config/database");

async function crearNotificacion({
  usuario_id,
  tipo,
  titulo,
  mensaje,
  referencia_tipo = null,
  referencia_id = null,
}) {
  await query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [usuario_id, tipo, titulo, mensaje, referencia_tipo, referencia_id]
  );
}

module.exports = { crearNotificacion };