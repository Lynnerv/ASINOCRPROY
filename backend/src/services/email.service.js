/**
 * Servicio de correo electrónico.
 *
 * Usa Nodemailer para enviar correos del sistema.
 * Configuración via variables de entorno en .env
 *
 * Variables requeridas:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=tu-correo@gmail.com
 *   SMTP_PASS=tu-app-password
 *   SMTP_FROM="ASIN Solutions <noreply@asin.com>"
 *   FRONTEND_URL=http://localhost:5173
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
    // Modo desarrollo: imprimir en consola
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║  CORREO (modo desarrollo - sin SMTP)     ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(`║  Para: ${to}`);
    console.log(`║  Asunto: ${subject}`);
    console.log("╠══════════════════════════════════════════╣");
    // Extraer el link del HTML
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

module.exports = { sendMail, sendPasswordResetEmail };
