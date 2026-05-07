/**
 * Servicio de Solicitudes ARCO (Ley 29733).
 *
 * Gestiona las solicitudes de Acceso, Rectificación, Cancelación
 * y Oposición de datos personales.
 */

const { query } = require("../config/database");
const emailService = require("./email.service");

/**
 * Crea una nueva solicitud ARCO.
 */
async function createSolicitud(data, ipAddress) {
  // Validar campos obligatorios
  const required = [
    "nombres", "apellidos", "tipo_documento", "numero_documento",
    "email", "tipo_usuario", "tipo_solicitud", "descripcion"
  ];
  const faltantes = required.filter((f) => !data[f] || String(data[f]).trim() === "");
  if (faltantes.length > 0) {
    throw Object.assign(
      new Error(`Campos obligatorios faltantes: ${faltantes.join(", ")}`),
      { status: 400 }
    );
  }

  // Validar formato email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw Object.assign(new Error("El correo electrónico no es válido"), { status: 400 });
  }

  // Validar descripción mínima
  if (String(data.descripcion).trim().length < 20) {
    throw Object.assign(
      new Error("La descripción debe tener al menos 20 caracteres"),
      { status: 400 }
    );
  }

  const result = await query(
    `INSERT INTO solicitudes_arco (
       nombres, apellidos, tipo_documento, numero_documento, email,
       telefono, domicilio, tipo_usuario, tipo_usuario_otro,
       tipo_solicitud, descripcion,
       es_representante, representante_nombre, representante_documento,
       ip_solicitante
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, creado_en`,
    [
      data.nombres.trim(),
      data.apellidos.trim(),
      data.tipo_documento,
      data.numero_documento.trim(),
      data.email.trim().toLowerCase(),
      data.telefono || null,
      data.domicilio || null,
      data.tipo_usuario,
      data.tipo_usuario_otro || null,
      data.tipo_solicitud,
      data.descripcion.trim(),
      data.es_representante || false,
      data.representante_nombre || null,
      data.representante_documento || null,
      ipAddress || null,
    ]
  );

  const inserted = result.rows[0];

  // Construir el objeto completo para los correos
  const solicitudCompleta = {
    id: inserted.id,
    creado_en: inserted.creado_en,
    nombres: data.nombres.trim(),
    apellidos: data.apellidos.trim(),
    tipo_documento: data.tipo_documento,
    numero_documento: data.numero_documento.trim(),
    email: data.email.trim().toLowerCase(),
    telefono: data.telefono || null,
    domicilio: data.domicilio || null,
    tipo_usuario: data.tipo_usuario,
    tipo_usuario_otro: data.tipo_usuario_otro || null,
    tipo_solicitud: data.tipo_solicitud,
    descripcion: data.descripcion.trim(),
    es_representante: data.es_representante || false,
    representante_nombre: data.representante_nombre || null,
    representante_documento: data.representante_documento || null,
  };

  // Enviar correos en paralelo, sin bloquear si fallan.
  // La solicitud queda guardada en BD pase lo que pase.
  Promise.allSettled([
    emailService.sendArcoConfirmation(solicitudCompleta),
    emailService.sendArcoNotification(solicitudCompleta),
  ]).then((results) => {
    results.forEach((r, i) => {
      const tipo = i === 0 ? "confirmación al titular" : "notificación interna";
      if (r.status === "rejected") {
        console.error(`[ARCO #${inserted.id}] Error enviando ${tipo}:`, r.reason?.message || r.reason);
      } else {
        console.log(`[ARCO #${inserted.id}] Correo de ${tipo} enviado correctamente`);
      }
    });
  });

  return {
    id: inserted.id,
    creado_en: inserted.creado_en,
    mensaje: "Solicitud recibida. Te enviamos una confirmación a tu correo. Te responderemos en un plazo máximo de 20 días hábiles.",
  };
}

/**
 * Lista todas las solicitudes ARCO (solo admin).
 */
async function listSolicitudes({ estado = null, tipo_solicitud = null } = {}) {
  const conditions = [];
  const params = [];

  if (estado) {
    params.push(estado);
    conditions.push(`estado = $${params.length}`);
  }
  if (tipo_solicitud) {
    params.push(tipo_solicitud);
    conditions.push(`tipo_solicitud = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT id, nombres, apellidos, tipo_documento, numero_documento,
            email, tipo_usuario, tipo_solicitud, descripcion,
            estado, creado_en
     FROM solicitudes_arco
     ${whereClause}
     ORDER BY creado_en DESC
     LIMIT 200`,
    params
  );

  return result.rows;
}

module.exports = {
  createSolicitud,
  listSolicitudes,
};
