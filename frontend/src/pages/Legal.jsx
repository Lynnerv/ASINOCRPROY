/**
 * Páginas legales (Ley 29733 + ISO 27001/27701).
 *
 * Rutas (renderizadas dentro del Layout):
 *   /legal/privacidad   → Política de Privacidad
 *   /legal/terminos     → Términos y Condiciones
 *   /legal/arco         → Derechos ARCO + Formulario
 *   /legal/marco        → Marco Legal y Normativo
 *   /legal/seguridad    → Medidas de Seguridad
 */

import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Shield, FileText, UserCheck, Lock, Scale, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { arcoApi } from "../api/arco";
import "../styles/legal.css";

const SECTIONS = [
  { slug: "privacidad", label: "Políticas de Privacidad", icon: Shield },
  { slug: "terminos", label: "Términos y Condiciones", icon: FileText },
  { slug: "arco", label: "Derechos ARCO", icon: UserCheck },
  { slug: "marco", label: "Marco Legal y Normativo", icon: Scale },
  { slug: "seguridad", label: "Medidas de Seguridad", icon: Lock },
];

export default function Legal() {
  const { section = "privacidad" } = useParams();

  return (
    <div className="legal-container">
      {/* Sidebar */}
      <aside className="legal-sidebar">
        <div className="legal-sidebar-title">CENTRO LEGAL</div>
        <nav className="legal-nav">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.slug}
                to={`/legal/${s.slug}`}
                className={`legal-nav-item ${section === s.slug ? "active" : ""}`}
              >
                <Icon size={15} />
                <span>{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="legal-content">
        {section === "privacidad" && <PrivacidadSection />}
        {section === "terminos" && <TerminosSection />}
        {section === "arco" && <ArcoSection />}
        {section === "marco" && <MarcoLegalSection />}
        {section === "seguridad" && <SeguridadSection />}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════
//  POLÍTICA DE PRIVACIDAD
// ══════════════════════════════════════════
function PrivacidadSection() {
  return (
    <article className="legal-article">
      <h1>Política de Privacidad</h1>
      <p className="legal-lead">Última actualización: abril 2026</p>

      <p>
        Esta Política de Privacidad se aplica al tratamiento de datos personales recopilados
        por <strong>ASIN SOLUTIONS E.I.R.L.</strong> (en adelante, "ASIN"), empresa peruana
        comprometida con resguardar la privacidad de los datos personales de los usuarios
        de su sistema de gestión documental.
      </p>

      <h2>I. Objetivo</h2>
      <p>
        Informar de manera clara cómo ASIN trata los datos personales de los usuarios
        de su plataforma web, los fines del tratamiento, las medidas de seguridad aplicadas
        y los derechos que les asisten conforme a la legislación peruana y a los estándares
        internacionales aplicables.
      </p>

      <h2>II. Marco Normativo</h2>
      <p>El tratamiento de datos personales se rige por:</p>
      <ul>
        <li><strong>Ley N° 29733</strong> — Ley de Protección de Datos Personales</li>
        <li><strong>Decreto Supremo N° 003-2013-JUS</strong> — Reglamento de la Ley N° 29733</li>
        <li><strong>ISO/IEC 27701:2019</strong> — Gestión de privacidad de la información</li>
        <li>Directivas emitidas por la Autoridad Nacional de Protección de Datos Personales (ANPDP)</li>
      </ul>
      <p>
        Para conocer el detalle de estos marcos y cómo los aplicamos, consulta la sección
        <Link to="/legal/marco"> Marco Legal y Normativo</Link>.
      </p>

      <h2>III. Datos Personales Recopilados</h2>
      <p>ASIN aplica el principio de <strong>minimización de datos</strong> (ISO 27701) y solo recopila lo estrictamente necesario:</p>
      <ul>
        <li><strong>Datos de identificación:</strong> nombre completo, correo electrónico corporativo</li>
        <li><strong>Credenciales:</strong> contraseña (almacenada cifrada con bcrypt, nunca en texto plano)</li>
        <li><strong>Datos de cuenta:</strong> rol asignado, fecha de creación, último acceso</li>
        <li><strong>Datos técnicos:</strong> dirección IP durante inicios de sesión, acciones realizadas (auditoría)</li>
      </ul>

      <h2>IV. Finalidad del Tratamiento</h2>
      <p>Los datos personales recopilados son tratados únicamente para las siguientes finalidades:</p>
      <ul>
        <li>Gestionar el acceso y autenticación del usuario al sistema</li>
        <li>Registrar las acciones realizadas en el sistema (trazabilidad y auditoría)</li>
        <li>Comunicar al usuario sobre el estado de los procesos que ha iniciado</li>
        <li>Enviar correos de recuperación de contraseña cuando el usuario lo solicite</li>
        <li>Cumplir con obligaciones legales y requerimientos de autoridades competentes</li>
      </ul>

      <h2>V. Conservación y Borrado de los Datos</h2>
      <p>
        En cumplimiento de los principios de <strong>retención limitada</strong> de la ISO 27701,
        los datos personales serán conservados mientras el usuario mantenga una cuenta
        activa en el sistema. Una vez desactivada la cuenta, los datos se conservarán
        por un plazo de 5 años con fines de auditoría, luego del cual serán eliminados
        de manera segura.
      </p>

      <h2>VI. Transferencia de Datos</h2>
      <p>
        ASIN no comercializa ni transfiere datos personales a terceros. Los datos
        son almacenados en servidores gestionados por <strong>Supabase</strong>, proveedor de
        infraestructura cloud que cumple con estándares internacionales de seguridad
        (SOC 2, GDPR, HIPAA).
      </p>

      <h2>VII. Derechos del Titular (ARCO)</h2>
      <p>
        Como titular de los datos personales, usted tiene derecho a ejercer los
        derechos de <strong>Acceso, Rectificación, Cancelación y Oposición</strong>.
        Puede ejercerlos enviando una solicitud a través del formulario disponible
        en la sección <Link to="/legal/arco">Derechos ARCO</Link>.
      </p>

      <h2>VIII. Contacto</h2>
      <p>
        Para consultas relacionadas con esta política, puede escribirnos a:
        <br /><strong>privacidad@asinsolutions.com</strong>
      </p>
    </article>
  );
}

// ══════════════════════════════════════════
//  TÉRMINOS Y CONDICIONES
// ══════════════════════════════════════════
function TerminosSection() {
  return (
    <article className="legal-article">
      <h1>Términos y Condiciones de Uso</h1>
      <p className="legal-lead">Última actualización: abril 2026</p>

      <h2>1. Aceptación de los Términos</h2>
      <p>
        Al acceder y utilizar el sistema de gestión documental de ASIN SOLUTIONS E.I.R.L.,
        el usuario acepta quedar obligado por los presentes Términos y Condiciones.
        Si no está de acuerdo con alguno de ellos, debe abstenerse de usar la plataforma.
      </p>

      <h2>2. Descripción del Servicio</h2>
      <p>
        ASIN ofrece una plataforma web para la gestión, procesamiento y validación
        de cartas de notificación de Valores Máximos Admisibles (VMA), destinada al
        uso de operadores autorizados por la empresa contratante.
      </p>

      <h2>3. Cuenta de Usuario</h2>
      <p>El usuario se compromete a:</p>
      <ul>
        <li>Proporcionar información verdadera y actualizada en su cuenta</li>
        <li>Mantener la confidencialidad de su contraseña</li>
        <li>No compartir sus credenciales con terceros</li>
        <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
        <li>Cerrar sesión al finalizar el uso del sistema</li>
      </ul>

      <h2>4. Uso Permitido</h2>
      <p>El usuario se compromete a utilizar el sistema únicamente para:</p>
      <ul>
        <li>Procesar documentos de los que tiene autorización legítima</li>
        <li>Realizar las funciones inherentes a su rol asignado</li>
        <li>Cumplir con las políticas internas de la empresa contratante</li>
      </ul>

      <h2>5. Uso Prohibido</h2>
      <p>Queda expresamente prohibido:</p>
      <ul>
        <li>Usar el sistema para fines ilícitos o no autorizados</li>
        <li>Intentar acceder a datos o áreas restringidas sin permiso</li>
        <li>Realizar ingeniería inversa del software</li>
        <li>Introducir virus, malware o código malicioso</li>
        <li>Extraer masivamente datos de la plataforma</li>
      </ul>

      <h2>6. Propiedad Intelectual</h2>
      <p>
        Todo el contenido del sistema (código, interfaz, logos, documentación) es
        propiedad de ASIN SOLUTIONS E.I.R.L. y está protegido por las leyes de
        propiedad intelectual peruanas e internacionales.
      </p>

      <h2>7. Limitación de Responsabilidad</h2>
      <p>
        ASIN no será responsable por daños derivados del mal uso del sistema por
        parte del usuario, interrupciones del servicio por causas de fuerza mayor
        o errores en los datos extraídos por el procesamiento automático (los
        cuales siempre deben ser validados por el operador).
      </p>

      <h2>8. Modificaciones</h2>
      <p>
        ASIN se reserva el derecho de modificar estos Términos en cualquier momento.
        Los cambios serán notificados mediante el sistema con al menos 15 días de
        anticipación.
      </p>

      <h2>9. Jurisdicción</h2>
      <p>
        Cualquier controversia derivada de estos Términos se someterá a la
        jurisdicción de los tribunales de Lima, Perú.
      </p>
    </article>
  );
}

// ══════════════════════════════════════════
//  MARCO LEGAL Y NORMATIVO
// ══════════════════════════════════════════
function MarcoLegalSection() {
  return (
    <article className="legal-article">
      <h1>Marco Legal y Normativo</h1>
      <p className="legal-lead">
        Normas, estándares y buenas prácticas que fundamentan nuestro sistema
      </p>

      <p>
        El sistema de gestión documental de ASIN SOLUTIONS E.I.R.L. ha sido diseñado
        y desarrollado siguiendo marcos normativos nacionales e internacionales
        aplicables al tratamiento de datos personales, la seguridad de la información
        y la gestión documental. A continuación se detallan las normas de referencia
        y cómo se aplican en el proyecto.
      </p>

      <div className="marco-table-wrapper">
        <table className="marco-table">
          <thead>
            <tr>
              <th>Marco legal / Norma</th>
              <th>Requisito clave</th>
              <th>Aplicación en el proyecto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Ley N° 29733</strong><br /><span className="norm-country">Perú</span></td>
              <td>Protección de datos personales, derechos ARCO y medidas de seguridad</td>
              <td>Recolección mínima de datos, aviso de privacidad, control de accesos y atención de solicitudes ARCO</td>
            </tr>
            <tr>
              <td><strong>ISO/IEC 27001:2022</strong><br /><span className="norm-country">Internacional</span></td>
              <td>Controles de acceso, respaldo, auditoría y seguridad de la información</td>
              <td>Gestión de accesos por roles, uso de HTTPS/TLS, respaldo de información y registro de eventos relevantes</td>
            </tr>
            <tr>
              <td><strong>ISO/IEC 27701:2019</strong><br /><span className="norm-country">Internacional</span></td>
              <td>Privacidad por diseño, minimización, retención y borrado</td>
              <td>Formularios mínimos, tratamiento limitado de datos y políticas de conservación documental</td>
            </tr>
            <tr>
              <td><strong>Buenas prácticas de transformación digital</strong></td>
              <td>Continuidad, trazabilidad y seguridad de los servicios digitales</td>
              <td>Registro de operaciones, organización documental y mantenimiento del sistema</td>
            </tr>
            <tr>
              <td><strong>Buenas prácticas de gestión documental</strong></td>
              <td>Clasificación, conservación y disponibilidad ordenada de documentos</td>
              <td>Uso de metadatos, repositorio centralizado y control de acceso a expedientes</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>¿Por qué estos marcos?</h2>
      <p>
        La combinación de estos marcos garantiza un enfoque integral: la <strong>Ley N° 29733</strong> establece
        el marco legal peruano, la <strong>ISO/IEC 27001</strong> aporta los controles técnicos de seguridad
        de la información, y la <strong>ISO/IEC 27701</strong> extiende estos controles con requisitos
        específicos de privacidad. Las buenas prácticas de transformación digital y gestión documental
        complementan estos estándares con lineamientos operativos para la continuidad del servicio
        y la organización de la información.
      </p>

      <h2>Verificación y mejora continua</h2>
      <p>
        El cumplimiento de estos marcos se revisa periódicamente mediante auditorías internas,
        revisiones de accesos y actualizaciones del sistema. Para conocer las medidas técnicas
        concretas que implementamos, consulta la sección
        <Link to="/legal/seguridad"> Medidas de Seguridad</Link>.
      </p>

      <h2>Artículos de la Ley N° 29733 aplicados en nuestro sistema</h2>
      <p>
        A continuación se detallan los artículos específicos de la Ley de Protección de
        Datos Personales que aplicamos en el funcionamiento diario del sistema y en
        la atención de los derechos de nuestros usuarios.
      </p>

      <div className="ley-table-wrapper">
        <table className="ley-table">
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Artículo</th>
              <th style={{ width: "22%" }}>Nombre / Principio</th>
              <th style={{ width: "36%" }}>Contenido de la Ley</th>
              <th style={{ width: "32%" }}>Aplicación en ASIN Solutions</th>
            </tr>
          </thead>
          <tbody>
            {LEY_29733_ARTICULOS.map((a) => (
              <tr key={a.articulo}>
                <td><strong>{a.articulo}</strong></td>
                <td><strong>{a.nombre}</strong></td>
                <td>{a.contenido}</td>
                <td>{a.aplicacion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

// ══════════════════════════════════════════
//  DERECHOS ARCO + FORMULARIO
// ══════════════════════════════════════════
function ArcoSection() {
  const [form, setForm] = useState({
    nombres: "", apellidos: "",
    tipo_documento: "DNI", numero_documento: "",
    email: "", telefono: "", domicilio: "",
    tipo_usuario: "operador", tipo_usuario_otro: "",
    tipo_solicitud: "", descripcion: "",
    es_representante: false,
    representante_nombre: "", representante_documento: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function updateField(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setResult(null);
    setSubmitting(true);
    try {
      const { data } = await arcoApi.createSolicitud(form);
      setResult({ type: "success", message: data.mensaje, id: data.id });
      setForm({
        nombres: "", apellidos: "",
        tipo_documento: "DNI", numero_documento: "",
        email: "", telefono: "", domicilio: "",
        tipo_usuario: "operador", tipo_usuario_otro: "",
        tipo_solicitud: "", descripcion: "",
        es_representante: false,
        representante_nombre: "", representante_documento: "",
      });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al enviar la solicitud";
      setResult({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className="legal-article">
      <h1>Formato de Solicitud de Derechos ARCO</h1>
      <p className="legal-lead">
        Acceso, Rectificación, Cancelación y Oposición de Datos Personales
      </p>

      <p>
        <strong>ASIN SOLUTIONS E.I.R.L.</strong>, en cumplimiento de lo dispuesto por
        la Ley N° 29733, Ley de Protección de Datos Personales, y su Reglamento
        (Decreto Supremo N° 003-2013-JUS), pone a su disposición un procedimiento
        para el ejercicio de los derechos de Acceso, Rectificación, Cancelación y
        Oposición respecto de sus datos personales contenidos en nuestras bases de datos.
      </p>

      <p>
        A fin de atender adecuadamente su solicitud, le pedimos que nos proporcione
        la siguiente información:
      </p>

      {result && (
        <div className={`legal-alert legal-alert-${result.type}`}>
          {result.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <div>
            <strong>{result.message}</strong>
            {result.id && <div className="legal-alert-meta">N° de solicitud: #{result.id}</div>}
          </div>
        </div>
      )}

      <form className="arco-form" onSubmit={handleSubmit}>
        {/* Datos del titular */}
        <div className="arco-section">
          <h3>Datos del titular de los datos personales</h3>
          <div className="arco-row arco-row-2">
            <Field label="Nombres" name="nombres" value={form.nombres} onChange={updateField} required />
            <Field label="Apellidos" name="apellidos" value={form.apellidos} onChange={updateField} required />
          </div>
          <div className="arco-row arco-row-2">
            <FieldSelect label="Tipo de documento" name="tipo_documento" value={form.tipo_documento} onChange={updateField} required
              options={[
                { value: "DNI", label: "DNI" },
                { value: "CE", label: "Carnet de Extranjería" },
                { value: "PASAPORTE", label: "Pasaporte" },
                { value: "RUC", label: "RUC" },
              ]} />
            <Field label="N° de documento" name="numero_documento" value={form.numero_documento} onChange={updateField} required />
          </div>
          <div className="arco-row arco-row-2">
            <Field label="Correo electrónico" name="email" type="email" value={form.email} onChange={updateField} required />
            <Field label="Teléfono" name="telefono" value={form.telefono} onChange={updateField} />
          </div>
          <Field label="Domicilio" name="domicilio" value={form.domicilio} onChange={updateField} />
        </div>

        {/* Tipo de usuario */}
        <div className="arco-section">
          <h3>Tipo de vínculo con ASIN</h3>
          <div className="arco-radios">
            {["operador", "administrador", "cliente", "proveedor", "otro"].map((tipo) => (
              <label key={tipo} className="arco-radio">
                <input type="radio" name="tipo_usuario" value={tipo}
                  checked={form.tipo_usuario === tipo} onChange={updateField} />
                <span>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span>
              </label>
            ))}
          </div>
          {form.tipo_usuario === "otro" && (
            <Field label="Especifique" name="tipo_usuario_otro"
              value={form.tipo_usuario_otro} onChange={updateField} />
          )}
        </div>

        {/* Tipo de solicitud */}
        <div className="arco-section">
          <h3>Seleccione el tipo de solicitud que desea ingresar</h3>
          <div className="arco-options">
            <ArcoOption value="ACCESO" label="ACCESO" current={form.tipo_solicitud} onChange={updateField}
              desc="Acción destinada a obtener, de la Empresa, la información sobre uno mismo almacenada en el banco de datos, así como aquella referida a las condiciones y generalidades del tratamiento de dicha información." />
            <ArcoOption value="RECTIFICACION" label="RECTIFICACIÓN" current={form.tipo_solicitud} onChange={updateField}
              desc="Acción destinada a actualizar sus datos; corregir aquella información que resulte inexacta, errónea o falsa; y/o incluir información en el banco de datos. Deberá adjuntar la información que sustente la rectificación." />
            <ArcoOption value="CANCELACION" label="CANCELACIÓN" current={form.tipo_solicitud} onChange={updateField}
              desc="Acción de supresión de información personal almacenada en un banco de datos en razón a que esta ya no es necesaria o pertinente para la finalidad para la cual fue recopilada, o cuando haya revocado el consentimiento otorgado." />
            <ArcoOption value="OPOSICION" label="OPOSICIÓN" current={form.tipo_solicitud} onChange={updateField}
              desc="Acción de impedir el tratamiento de datos personales o cese del mismo, cuando el titular no hubiere prestado su consentimiento o cuando acredite que medien motivos fundados y legítimos relativos a una concreta situación personal que lo justifiquen." />
          </div>
        </div>

        {/* Descripción */}
        <div className="arco-section">
          <h3>Descripción de la solicitud</h3>
          <p className="arco-help">
            Exponga de forma clara y precisa los alcances de su solicitud, señalando
            la información a la que desea acceder, rectificar, cancelar o respecto de
            la cual desea formular oposición.
          </p>
          <textarea
            name="descripcion"
            className="arco-textarea"
            value={form.descripcion}
            onChange={updateField}
            maxLength={1000}
            rows={6}
            placeholder="Descripción..."
            required
          />
          <div className="arco-char-count">{form.descripcion.length} / 1000 caracteres</div>
        </div>

        {/* Representante legal */}
        <div className="arco-section">
          <label className="arco-check">
            <input type="checkbox" name="es_representante"
              checked={form.es_representante} onChange={updateField} />
            <span>Presento esta solicitud como representante legal del titular</span>
          </label>
          {form.es_representante && (
            <div className="arco-row arco-row-2" style={{ marginTop: "12px" }}>
              <Field label="Nombre del representante" name="representante_nombre"
                value={form.representante_nombre} onChange={updateField} />
              <Field label="N° de documento del representante" name="representante_documento"
                value={form.representante_documento} onChange={updateField} />
            </div>
          )}
        </div>

        {/* Notificación */}
        <div className="arco-notice">
          <strong>NOTIFICACIÓN DE LA RESPUESTA</strong>
          <p>
            ASIN SOLUTIONS E.I.R.L. procederá a notificar la respuesta a su solicitud
            a la dirección de correo electrónico indicada en el presente formulario,
            dentro de los plazos establecidos en el Reglamento de la Ley N° 29733.
            Si transcurren los plazos sin haber recibido respuesta, usted podrá
            considerar denegada su solicitud, quedando a salvo su derecho de iniciar
            un procedimiento de tutela ante la Dirección General de Protección de
            Datos Personales (Ministerio de Justicia).
          </p>
        </div>

        <button type="submit" className="arco-submit" disabled={submitting}>
          {submitting ? <Loader size={16} className="spin" /> : "Enviar solicitud"}
        </button>
      </form>
    </article>
  );
}

// ══════════════════════════════════════════
//  LEY N° 29733 APLICADA
// ══════════════════════════════════════════

const LEY_29733_ARTICULOS = [
  {
    articulo: "Art. 5",
    nombre: "Principio de Consentimiento",
    contenido: "Para el tratamiento de los datos personales debe mediar el consentimiento de su titular, que sea previo, informado, expreso e inequívoco.",
    aplicacion: "El registro de usuarios solo se realiza con autorización expresa del trabajador. El formulario de solicitudes ARCO y el aviso de privacidad informan al titular antes de cualquier tratamiento.",
  },
  {
    articulo: "Art. 6",
    nombre: "Principio de Finalidad",
    contenido: "Los datos personales deben ser recopilados para una finalidad determinada, explícita y lícita. No deben usarse para otra finalidad distinta a la establecida al momento de la recopilación.",
    aplicacion: "Los datos recopilados (nombre, correo, rol) se usan únicamente para autenticación, trazabilidad de acciones y comunicación del estado de los procesos documentales. No se destinan a publicidad, venta ni cesión a terceros.",
  },
  {
    articulo: "Art. 7",
    nombre: "Principio de Proporcionalidad",
    contenido: "Todo tratamiento de datos personales debe ser adecuado, relevante y no excesivo a la finalidad para la que fueron recopilados.",
    aplicacion: "Solo se solicitan los datos estrictamente necesarios: nombre completo, correo corporativo y contraseña cifrada. No se recopilan datos sensibles (salud, religión, orientación sexual, etc.) porque no son necesarios para la gestión documental.",
  },
  {
    articulo: "Art. 8",
    nombre: "Principio de Calidad",
    contenido: "Los datos personales deben ser veraces, exactos, actualizados y pertinentes. Deben conservarse solo por el tiempo necesario para cumplir con la finalidad del tratamiento.",
    aplicacion: 'El módulo "Gestionar perfil" permite al usuario actualizar sus datos en cualquier momento. Los datos de cuentas desactivadas se conservan un máximo de 5 años por trazabilidad, luego son eliminados de forma segura.',
  },
  {
    articulo: "Art. 9",
    nombre: "Principio de Seguridad",
    contenido: "El titular del banco de datos personales debe adoptar medidas técnicas, organizativas y legales necesarias para garantizar la seguridad de los datos personales, evitando su alteración, pérdida, tratamiento o acceso no autorizado.",
    aplicacion: "Se implementan controles alineados con ISO/IEC 27001:2022: cifrado de contraseñas, tokens de sesión firmados, comunicaciones cifradas HTTPS/TLS, control de acceso por roles, respaldos automáticos diarios y registro de auditoría de todas las acciones sensibles.",
  },
  {
    articulo: "Art. 18",
    nombre: "Derecho de Información del titular",
    contenido: "El titular tiene derecho a recibir información previa, expresa, precisa e inequívoca sobre la finalidad del tratamiento de sus datos personales, los destinatarios y la identidad del responsable del banco de datos.",
    aplicacion: 'La sección "Política de Privacidad" del sistema informa de forma clara y accesible qué datos se recolectan, con qué finalidad, quién los almacena y el contacto del responsable (privacidad@asinsolutions.com).',
  },
  {
    articulo: "Art. 19",
    nombre: "Derecho de Acceso (A)",
    contenido: "El titular puede solicitar y obtener la información relativa a sus datos personales incluidos en los bancos de datos, así como conocer las condiciones y generalidades del tratamiento.",
    aplicacion: "Implementado mediante el formulario de Derechos ARCO disponible en la sección legal del sistema. La solicitud queda registrada y se confirma automáticamente por correo electrónico al titular.",
  },
  {
    articulo: "Art. 20",
    nombre: "Derecho de Rectificación y Cancelación (R, C)",
    contenido: "El titular tiene derecho a la rectificación de sus datos personales incompletos, inexactos, erróneos o falsos; y a la cancelación (supresión) cuando estos hayan dejado de ser necesarios para la finalidad con la cual fueron recopilados.",
    aplicacion: 'El operador puede rectificar sus datos desde "Gestionar perfil". Para cancelación, el titular puede solicitarla a través del formulario ARCO, y el administrador procede a desactivar la cuenta y borrar los datos conforme al plazo legal.',
  },
  {
    articulo: "Art. 22",
    nombre: "Derecho de Oposición (O)",
    contenido: "El titular puede oponerse al tratamiento de sus datos cuando existan motivos fundados y legítimos relativos a una concreta situación personal. En caso de oposición justificada, se debe proceder a su supresión.",
    aplicacion: "El formulario ARCO permite ejercer el derecho de oposición en cualquier momento. El administrador del sistema atiende la solicitud dentro del plazo máximo de 20 días hábiles establecido en el Reglamento.",
  },
];

// ══════════════════════════════════════════
//  MEDIDAS DE SEGURIDAD
// ══════════════════════════════════════════
function SeguridadSection() {
  return (
    <article className="legal-article">
      <h1>Medidas de Seguridad</h1>
      <p className="legal-lead">Cómo protegemos tus datos personales</p>

      <p>
        En ASIN SOLUTIONS E.I.R.L. aplicamos medidas técnicas, organizativas y legales
        que garantizan la seguridad de los datos personales que tratamos, en
        cumplimiento del artículo 9 de la Ley N° 29733 y alineadas con los controles
        de la norma internacional <strong>ISO/IEC 27001:2022</strong>. Para conocer el
        detalle de los marcos aplicables, consulta la sección
        <Link to="/legal/marco"> Marco Legal y Normativo</Link>.
      </p>

      <h2>1. Seguridad en el Acceso</h2>
      <ul>
        <li><strong>Autenticación por contraseña:</strong> las contraseñas se almacenan
          usando el algoritmo <strong>bcrypt</strong> con 12 rondas de cifrado — son
          irreversibles, ni siquiera los administradores pueden verlas en texto plano.</li>
        <li><strong>Tokens JWT firmados:</strong> las sesiones usan JSON Web Tokens
          con firma HMAC-SHA256 y expiración automática de 8 horas.</li>
        <li><strong>Control de acceso por roles:</strong> cada usuario solo puede
          acceder a las funcionalidades autorizadas para su rol (administrador u operador),
          alineado con el control A.9 de ISO 27001.</li>
        <li><strong>Política de contraseñas:</strong> mínimo 8 caracteres, al menos
          una mayúscula y un número.</li>
      </ul>

      <h2>2. Cifrado en Tránsito</h2>
      <ul>
        <li><strong>HTTPS / TLS 1.3:</strong> todas las comunicaciones entre el navegador
          y el servidor viajan cifradas (control A.13 de ISO 27001).</li>
        <li><strong>Conexión SSL a base de datos:</strong> la conexión entre el
          servidor de aplicaciones y la base de datos está cifrada con SSL/TLS.</li>
      </ul>

      <h2>3. Seguridad en la Nube</h2>
      <ul>
        <li><strong>Supabase (PostgreSQL gestionado):</strong> proveedor que cumple
          con estándares SOC 2 Type II, GDPR y HIPAA.</li>
        <li><strong>Backups automáticos diarios</strong> con retención de 7 días
          (control A.12.3 de ISO 27001 — respaldo de información).</li>
        <li><strong>Aislamiento por Row-Level Security</strong> para proteger datos
          entre tenants.</li>
      </ul>

      <h2>4. Trazabilidad y Auditoría</h2>
      <ul>
        <li><strong>Registro de acciones:</strong> cada acción sensible queda registrada
          en la tabla <code>historial_acciones</code> con usuario, fecha, IP y detalle
          (control A.12.4 de ISO 27001 — registro y monitoreo).</li>
        <li><strong>Trazabilidad del procesamiento:</strong> cada documento procesado
          conserva el registro de quién lo subió, quién lo validó y cuándo.</li>
      </ul>

      <h2>5. Recuperación de Contraseña Segura</h2>
      <ul>
        <li><strong>Tokens aleatorios de 64 caracteres</strong> generados con
          <code> crypto.randomBytes</code>.</li>
        <li><strong>Expiración de 1 hora</strong> desde el momento de emisión.</li>
        <li><strong>Uso único:</strong> el token se invalida después de usarse.</li>
        <li><strong>No revelamos</strong> si un correo está registrado o no, para
          prevenir enumeración de usuarios.</li>
      </ul>

      <h2>6. Minimización de Datos</h2>
      <ul>
        <li>Solo recopilamos los datos estrictamente necesarios para el servicio
          (alineado con ISO 27701 — privacidad por diseño).</li>
        <li>No tratamos datos sensibles (salud, creencias, etc.).</li>
        <li>Los datos extraídos por OCR son verificables y editables por el operador.</li>
      </ul>

      <h2>7. Protección contra Ataques Comunes</h2>
      <ul>
        <li><strong>SQL Injection:</strong> todas las consultas usan parámetros
          preparados (prepared statements).</li>
        <li><strong>XSS:</strong> React escapa automáticamente el contenido
          dinámico en el frontend.</li>
        <li><strong>CSRF:</strong> protección mediante tokens JWT en header
          Authorization (no cookies).</li>
      </ul>

      <h2>8. Responsabilidad del Usuario</h2>
      <p>
        Aunque implementamos estas medidas, la seguridad de tu cuenta también
        depende de ti:
      </p>
      <ul>
        <li>No compartas tu contraseña con nadie.</li>
        <li>Usa contraseñas distintas para diferentes servicios.</li>
        <li>Cierra sesión en computadoras compartidas.</li>
        <li>Reporta cualquier actividad sospechosa a nuestro equipo.</li>
      </ul>
    </article>
  );
}

// ══════════════════════════════════════════
//  Sub-components
// ══════════════════════════════════════════

function Field({ label, name, value, onChange, type = "text", required = false }) {
  return (
    <div className="arco-field">
      <label>{label}{required && " *"}</label>
      <input type={type} name={name} value={value} onChange={onChange} required={required} />
    </div>
  );
}

function FieldSelect({ label, name, value, onChange, options, required = false }) {
  return (
    <div className="arco-field">
      <label>{label}{required && " *"}</label>
      <select name={name} value={value} onChange={onChange} required={required}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ArcoOption({ value, label, desc, current, onChange }) {
  return (
    <label className={`arco-option ${current === value ? "active" : ""}`}>
      <input type="radio" name="tipo_solicitud" value={value}
        checked={current === value} onChange={onChange} required />
      <div className="arco-option-content">
        <div className="arco-option-label">{label}</div>
        <div className="arco-option-desc">{desc}</div>
      </div>
    </label>
  );
}
