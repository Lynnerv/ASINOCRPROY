/**
 * Servicio de correo electrónico.
 *
 * Usa Nodemailer para enviar correos del sistema.
 *
 * Variables requeridas:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=tu-correo@gmail.com
 *   SMTP_PASS=tu-app-password
 *   SMTP_FROM="ASIN Solutions <noreply@asin.com>"
 *   FRONTEND_URL=http://localhost:5173
 *   ARCO_NOTIFICATION_EMAIL=asinsolutions7@gmail.com
 */

const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn(
      "[Email] SMTP no configurado. Los correos se imprimirán en consola."
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Envía un correo electrónico.
 * Si SMTP no está configurado, imprime en consola (modo desarrollo).
 */
async function sendMail({ to, subject, html }) {
  const transport = getTransporter();

  if (!transport) {
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║  CORREO (modo desarrollo - sin SMTP)     ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Para: ${to}`);
    console.log(`║  Asunto: ${subject}`);
    console.log("╠══════════════════════════════════════════╣");
    const linkMatch = html.match(/href="([^"]+)"/);
    if (linkMatch) {
      console.log(`║  LINK: ${linkMatch[1]}`);
    }
    console.log("╚══════════════════════════════════════════╝\n");
    return { accepted: [to], messageId: "dev-mode" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const info = await transport.sendMail({ from, to, subject, html });
  return info;
}

/**
 * Envía correo de recuperación de contraseña.
 */
async function sendPasswordResetEmail(correo, token) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/restablecer/${token}`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0;">ASIN SOLUTIONS</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Sistema de Gestión Documental</p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      
      <h3 style="color: #1e293b; font-size: 17px; margin: 0 0 8px;">Recuperar contraseña</h3>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
        Recibimos una solicitud para restablecer tu contraseña. 
        Haz clic en el botón para crear una nueva:
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; 
                  text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Restablecer contraseña
        </a>
      </div>
      
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
        Este enlace es válido por <strong>1 hora</strong>. Si no solicitaste este cambio, ignora este correo.
      </p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      
      <p style="color: #94a3b8; font-size: 11px; text-align: center;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
        <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
      </p>
    </div>
  `;

  return sendMail({
    to: correo,
    subject: "Recuperar contraseña - ASIN Solutions",
    html,
  });
}

// ══════════════════════════════════════════════════════════
//  CORREOS DE SOLICITUDES ARCO (Ley 29733)
// ══════════════════════════════════════════════════════════

const TIPO_SOLICITUD_LABELS = {
  ACCESO: "Acceso",
  RECTIFICACION: "Rectificación",
  CANCELACION: "Cancelación",
  OPOSICION: "Oposición",
};

/**
 * Correo de confirmación al titular de los datos personales.
 * Cumple con el Art. 24 del Reglamento de la Ley 29733.
 */
async function sendArcoConfirmation(solicitud) {
  const tipoLabel = TIPO_SOLICITUD_LABELS[solicitud.tipo_solicitud] || solicitud.tipo_solicitud;
  const fechaStr = new Date(solicitud.creado_en).toLocaleDateString("es-PE", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0;">ASIN SOLUTIONS E.I.R.L.</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Sistema de Gestión Documental</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

      <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
        <h3 style="color: #15803d; font-size: 16px; margin: 0 0 4px;">✓ Solicitud recibida correctamente</h3>
        <p style="color: #166534; font-size: 13px; margin: 0;">N° de solicitud: <strong>#${solicitud.id}</strong></p>
      </div>

      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Estimado(a) <strong>${solicitud.nombres} ${solicitud.apellidos}</strong>,
      </p>

      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Hemos recibido su solicitud de derecho de <strong>${tipoLabel}</strong> de datos personales,
        en cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales, y su Reglamento
        aprobado por Decreto Supremo N° 003-2013-JUS.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; color: #64748b; font-weight: 600; border-radius: 6px 0 0 6px;">N° de solicitud</td>
          <td style="padding: 8px 12px; background: #f8fafc; color: #1e293b; border-radius: 0 6px 6px 0;">#${solicitud.id}</td>
        </tr>
        <tr><td style="height: 6px;"></td></tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; color: #64748b; font-weight: 600; border-radius: 6px 0 0 6px;">Tipo de derecho</td>
          <td style="padding: 8px 12px; background: #f8fafc; color: #1e293b; border-radius: 0 6px 6px 0;">${tipoLabel}</td>
        </tr>
        <tr><td style="height: 6px;"></td></tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; color: #64748b; font-weight: 600; border-radius: 6px 0 0 6px;">Fecha de recepción</td>
          <td style="padding: 8px 12px; background: #f8fafc; color: #1e293b; border-radius: 0 6px 6px 0;">${fechaStr}</td>
        </tr>
        <tr><td style="height: 6px;"></td></tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8fafc; color: #64748b; font-weight: 600; border-radius: 6px 0 0 6px;">Documento</td>
          <td style="padding: 8px 12px; background: #f8fafc; color: #1e293b; border-radius: 0 6px 6px 0;">${solicitud.tipo_documento} ${solicitud.numero_documento}</td>
        </tr>
      </table>

      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin: 24px 0;">
        <p style="color: #78350f; font-size: 13px; line-height: 1.6; margin: 0;">
          <strong>Plazo de respuesta:</strong> Le responderemos a esta misma dirección de correo
          electrónico en un plazo máximo de <strong>20 días hábiles</strong> contados desde la
          fecha de recepción, conforme a lo establecido en el Capítulo I del Título IV del
          Reglamento de la Ley N° 29733.
        </p>
      </div>

      <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 0 0 8px;">
        Si transcurrido el plazo no recibe respuesta, podrá considerar denegada su solicitud
        y tendrá derecho a iniciar un procedimiento de tutela ante la Dirección General de
        Protección de Datos Personales (Ministerio de Justicia y Derechos Humanos).
      </p>

      <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 16px 0 0;">
        Para cualquier consulta adicional, puede contactarnos a través del correo
        <a href="mailto:asinsolutions7@gmail.com" style="color: #2563eb;">asinsolutions7@gmail.com</a>
        indicando su número de solicitud.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Este es un correo automático generado por el sistema de ASIN SOLUTIONS E.I.R.L.<br>
        Por favor no responda a este mensaje.
      </p>
    </div>
  `;

  return sendMail({
    to: solicitud.email,
    subject: `Solicitud ARCO #${solicitud.id} recibida - ASIN Solutions`,
    html,
  });
}

/**
 * Notificación interna al equipo de ASIN sobre una nueva solicitud ARCO.
 */
async function sendArcoNotification(solicitud) {
  const notificationEmail =
    process.env.ARCO_NOTIFICATION_EMAIL || process.env.SMTP_USER;
  if (!notificationEmail) return;

  const tipoLabel = TIPO_SOLICITUD_LABELS[solicitud.tipo_solicitud] || solicitud.tipo_solicitud;
  const fechaStr = new Date(solicitud.creado_en).toLocaleString("es-PE");

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); padding: 20px 24px; border-radius: 10px; margin-bottom: 24px;">
        <h2 style="color: #ffffff; font-size: 18px; margin: 0;">📋 Nueva solicitud ARCO recibida</h2>
        <p style="color: #c7d2fe; font-size: 13px; margin: 4px 0 0;">Sistema ASIN Solutions · Ley N° 29733</p>
      </div>

      <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #78350f; font-size: 13px; margin: 0;">
          <strong>⏱ Plazo legal:</strong> Esta solicitud debe responderse en un máximo de <strong>20 días hábiles</strong>.
        </p>
      </div>

      <h3 style="color: #1e293b; font-size: 15px; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">
        Datos de la solicitud
      </h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600; width: 35%; vertical-align: top;">N° de solicitud</td>
          <td style="padding: 10px 14px; color: #1e293b;"><strong>#${solicitud.id}</strong></td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600; vertical-align: top;">Tipo de derecho</td>
          <td style="padding: 10px 14px;">
            <span style="display: inline-block; padding: 3px 10px; background: #ddd6fe; color: #5b21b6; border-radius: 12px; font-weight: 600; font-size: 12px;">${tipoLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600; vertical-align: top;">Fecha y hora</td>
          <td style="padding: 10px 14px; color: #1e293b;">${fechaStr}</td>
        </tr>
      </table>

      <h3 style="color: #1e293b; font-size: 15px; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">
        Datos del titular
      </h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600; width: 35%;">Nombre completo</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.nombres} ${solicitud.apellidos}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Documento</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.tipo_documento} ${solicitud.numero_documento}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Correo electrónico</td>
          <td style="padding: 10px 14px;"><a href="mailto:${solicitud.email}" style="color: #2563eb;">${solicitud.email}</a></td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Teléfono</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.telefono || "—"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Domicilio</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.domicilio || "—"}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Tipo de vínculo</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.tipo_usuario}${solicitud.tipo_usuario_otro ? ` (${solicitud.tipo_usuario_otro})` : ""}</td>
        </tr>
      </table>

      ${solicitud.es_representante ? `
      <h3 style="color: #1e293b; font-size: 15px; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">
        Representante legal
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600; width: 35%;">Nombre</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.representante_nombre || "—"}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Documento</td>
          <td style="padding: 10px 14px; color: #1e293b;">${solicitud.representante_documento || "—"}</td>
        </tr>
      </table>
      ` : ""}

      <h3 style="color: #1e293b; font-size: 15px; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">
        Descripción de la solicitud
      </h3>

      <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 18px; border-radius: 6px;">
        <p style="color: #334155; font-size: 13px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${escapeHtml(solicitud.descripcion)}</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px;">

      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Notificación automática del sistema ASIN Solutions.<br>
        Para responder esta solicitud, contacta directamente al titular en su correo electrónico.
      </p>
    </div>
  `;

  return sendMail({
    to: notificationEmail,
    subject: `[ARCO] Nueva solicitud #${solicitud.id} - ${tipoLabel} - ${solicitud.nombres} ${solicitud.apellidos}`,
    html,
  });
}

/** Escapa HTML para prevenir inyección en el cuerpo del correo. */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendArcoConfirmation,
  sendArcoNotification,
};
