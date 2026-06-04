/**
 * Servicio de Preparar Servicio (HU-16).
 *
 * Gestiona el registro de precio y fecha de programacion,
 * la validacion de fechas contra conflictos, el calendario
 * y la generacion de proforma y carta de programacion
 * a partir de las plantillas Word del sistema.
 */

const { query } = require("../config/database");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

function peruNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
}

// ══════════════════════════════════════════════════════════
//  Obtener datos del expediente para preparar servicio
// ══════════════════════════════════════════════════════════

async function getDatosServicio(expedienteId) {
  const result = await query(
    `SELECT e.id, e.estado, e.precio_servicio, e.fecha_programacion,
            e.numero_factura,
            c.nis, c.nia, c.nombre AS cliente, c.direccion, c.distrito
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.id = $1`,
    [expedienteId]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  const expediente = result.rows[0];

  // Obtener datos de los documentos (cartas validadas)
  const docsResult = await query(
    `SELECT id, numero_carta, fecha_carta, anexo, numero_acta,
            fecha_muestra, numero_informe, estado
     FROM documentos
     WHERE expediente_id = $1
     ORDER BY anexo ASC`,
    [expedienteId]
  );

  // Obtener parametros VMA por documento
  const docs = [];
  for (const doc of docsResult.rows) {
    const paramsResult = await query(
      `SELECT rp.resultado_valor, cp.codigo, cp.nombre_completo, cp.unidad, cp.vma_normado, cp.anexo
       FROM resultados_parametros rp
       JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
       WHERE rp.documento_id = $1
       ORDER BY cp.codigo`,
      [doc.id]
    );
    docs.push({ ...doc, parametros: paramsResult.rows });
  }

  return { expediente, documentos: docs };
}

// ══════════════════════════════════════════════════════════
//  Actualizar precio y fecha de programacion
// ══════════════════════════════════════════════════════════

async function updateDatosServicio(expedienteId, { precio_servicio, fecha_programacion }) {
  // Validar precio
  if (precio_servicio !== undefined && precio_servicio !== null) {
    const precio = parseFloat(precio_servicio);
    if (isNaN(precio) || precio <= 0) {
      throw Object.assign(new Error("El precio debe ser un numero mayor a 0"), { status: 400 });
    }
  }

  // Validar conflicto de fecha
  if (fecha_programacion) {
    const conflicto = await query(
      `SELECT e.id, c.nombre AS cliente, c.nis
       FROM expedientes e
       LEFT JOIN clientes c ON e.cliente_id = c.id
       WHERE e.fecha_programacion = $1 AND e.id != $2
         AND (e.visible IS NULL OR e.visible = true)`,
      [fecha_programacion, expedienteId]
    );

    if (conflicto.rows.length > 0) {
      const c = conflicto.rows[0];
      throw Object.assign(
        new Error(
          `La fecha ${fecha_programacion} ya esta asignada al expediente #${c.id} (${c.cliente || "Sin cliente"} - NIS: ${c.nis || "N/A"}). Seleccione otra fecha.`
        ),
        { status: 409 }
      );
    }
  }

  const result = await query(
    `UPDATE expedientes
     SET precio_servicio = COALESCE($2, precio_servicio),
         fecha_programacion = COALESCE($3, fecha_programacion),
         actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, precio_servicio, fecha_programacion`,
    [expedienteId, precio_servicio || null, fecha_programacion || null]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  return result.rows[0];
}

// ══════════════════════════════════════════════════════════
//  Calendario: fechas programadas de un mes
// ══════════════════════════════════════════════════════════

async function getCalendario(anio, mes) {
  const result = await query(
    `SELECT e.id, e.fecha_programacion, c.nombre AS cliente, c.nis
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE EXTRACT(YEAR FROM e.fecha_programacion) = $1
       AND EXTRACT(MONTH FROM e.fecha_programacion) = $2
       AND e.fecha_programacion IS NOT NULL
       AND (e.visible IS NULL OR e.visible = true)
     ORDER BY e.fecha_programacion ASC`,
    [anio, mes]
  );

  return result.rows;
}

// ══════════════════════════════════════════════════════════
//  Generar documentos Word desde plantillas
// ══════════════════════════════════════════════════════════

/**
 * Escapa caracteres especiales para XML.
 */
function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Rellena una plantilla .docx reemplazando los placeholders **VARIABLE**
 * con los valores proporcionados.
 *
 * Maneja el caso donde Word divide un placeholder en multiples
 * nodos XML (ej: <w:t>**</w:t>...<w:t>CLIENTE**</w:t>).
 *
 * Retorna un Buffer con el archivo .docx generado.
 */
function fillTemplate(templateFilename, replacements) {
  const templatePath = path.join(TEMPLATES_DIR, templateFilename);

  if (!fs.existsSync(templatePath)) {
    throw Object.assign(
      new Error(`Plantilla no encontrada: ${templateFilename}. Verifique que exista en la carpeta templates/`),
      { status: 500 }
    );
  }

  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  // Procesar document.xml principal
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw Object.assign(new Error("Plantilla corrupta: no contiene document.xml"), { status: 500 });
  }

  let docXml = docXmlFile.asText();
  docXml = replaceInXml(docXml, replacements);
  zip.file("word/document.xml", docXml);

  return zip.generate({
    type: "nodebuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Reemplaza placeholders **VARIABLE** en un string XML.
 * Paso 1: Reparar placeholders divididos en multiples runs.
 * Paso 2: Reemplazar **KEY** por el valor correspondiente.
 */
function replaceInXml(xml, replacements) {
  xml = xml.replace(
    /<w:t(?:\s[^>]*)?>(\*\*)<\/w:t>([\s\S]*?)<w:t(?:\s[^>]*)?>([A-Z0-9_]+\*\*)<\/w:t>/g,
    (match, stars, middle, varPart) => {
      return match
        .replace(`>${stars}</w:t>`, `></w:t>`)
        .replace(`>${varPart}</w:t>`, `>**${varPart}</w:t>`);
    }
  );

  xml = xml.replace(
    /<w:t(?:\s[^>]*)?>(\*)<\/w:t>([\s\S]*?)<w:t(?:\s[^>]*)?>([A-Z0-9_]+\*)<\/w:t>/g,
    (match, star, middle, varPart) => {
      return match
        .replace(`>${star}</w:t>`, `></w:t>`)
        .replace(`>${varPart}</w:t>`, `>*${varPart}</w:t>`);
    }
  );

  for (const [key, value] of Object.entries(replacements)) {
    const escaped = escapeXml(String(value));
    const regexDouble = new RegExp(`\\*\\*${key}\\*\\*`, "g");
    xml = xml.replace(regexDouble, escaped);
  }

  for (const [key, value] of Object.entries(replacements)) {
    const escaped = escapeXml(String(value));
    const regexSingle = new RegExp(`\\*${key}\\*`, "g");
    xml = xml.replace(regexSingle, escaped);
  }

  return xml;
}

/**
 * Formatea una fecha a formato largo en espanol.
 * Acepta: "2025-10-15", "2025-10-15T00:00:00.000Z", Date object
 * Resultado: "15 de Octubre de 2025"
 */
function formatFechaLarga(fecha) {
  if (!fecha) return "";
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  // Extraer solo la parte YYYY-MM-DD sin importar el formato de entrada
  let dateStr;
  if (fecha instanceof Date) {
    dateStr = fecha.toISOString().split("T")[0];
  } else {
    dateStr = String(fecha);
    if (dateStr.includes("T")) {
      dateStr = dateStr.split("T")[0];
    }
  }

  const parts = dateStr.split("-");
  if (parts.length !== 3) return String(fecha);

  const anio = parseInt(parts[0]);
  const mes = parseInt(parts[1]) - 1; // 0-indexed
  const dia = parseInt(parts[2]);

  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return String(fecha);

  return `${dia} de ${meses[mes]} de ${anio}`;
}

/**
 * Orden oficial de los parametros por anexo.
 * Si un parametro no esta en esta lista, va al final.
 */
const ORDEN_PARAMETROS_ANEXO1 = ["DBO5", "DQO", "SST", "AYG"];
const ORDEN_PARAMETROS_ANEXO2 = [
  "MN", "PH", "NH3", "S", "CR", "CR_T", "PB", "CN", "HG", "CD", "AS", "NI", "ZN", "AL", "B",
];

/**
 * Ordena un array de codigos de parametros segun el orden oficial.
 */
function sortParametros(codigos, ordenOficial) {
  return codigos.sort((a, b) => {
    const idxA = ordenOficial.indexOf(a);
    const idxB = ordenOficial.indexOf(b);
    // Si no esta en la lista, va al final
    const posA = idxA >= 0 ? idxA : 999;
    const posB = idxB >= 0 ? idxB : 999;
    return posA - posB;
  });
}

/**
 * Construye el texto de los parametros por anexo.
 * Ejemplo con solo Anexo 1: "1 (DBO5, DQO, SST)"
 * Ejemplo con ambos: "1 (DBO5, DQO, SST) Y ANEXO 2 (SULFUROS)"
 * Los parametros siempre se muestran en el orden oficial del catalogo.
 */
function buildAnexoTexts(documentos) {
  const anexo1Params = [];
  const anexo2Params = [];
  let hasAnexo1 = false;
  let hasAnexo2 = false;

  for (const doc of documentos) {
    if (doc.anexo === "Anexo 1") {
      hasAnexo1 = true;
      for (const p of (doc.parametros || [])) {
        if (!anexo1Params.includes(p.codigo)) {
          anexo1Params.push(p.codigo);
        }
      }
    } else if (doc.anexo === "Anexo 2") {
      hasAnexo2 = true;
      for (const p of (doc.parametros || [])) {
        if (!anexo2Params.includes(p.codigo)) {
          anexo2Params.push(p.codigo);
        }
      }
    }
  }

  // Ordenar parametros segun el catalogo oficial
  sortParametros(anexo1Params, ORDEN_PARAMETROS_ANEXO1);
  sortParametros(anexo2Params, ORDEN_PARAMETROS_ANEXO2);

  let tituloAnexo = "";
  let tituloParametro = "";
  if (hasAnexo1 && hasAnexo2) {
    tituloAnexo = "1 Y 2";
    tituloParametro = `1 (${anexo1Params.join(", ")}) Y ANEXO 2 (${anexo2Params.join(", ")})`;
  } else if (hasAnexo1) {
    tituloAnexo = "1";
    tituloParametro = `1 (${anexo1Params.join(", ")})`;
  } else if (hasAnexo2) {
    tituloAnexo = "2";
    tituloParametro = `2 (${anexo2Params.join(", ")})`;
  }

  return { tituloAnexo, tituloParametro, hasAnexo1, hasAnexo2 };
}

// ── Generar Proforma ──────────────────────────────────────

async function generarProforma(expedienteId) {
  const { expediente, documentos } = await getDatosServicio(expedienteId);

  if (!expediente.precio_servicio) {
    throw Object.assign(new Error("Debe registrar el precio del servicio antes de generar la proforma"), { status: 400 });
  }

  const { tituloAnexo, tituloParametro } = buildAnexoTexts(documentos);

  // Obtener datos de la primera carta (para numero_carta, numero_acta, etc.)
  const primerDoc = documentos[0] || {};

  const replacements = {
    FECHA: formatFechaLarga(new Date().toISOString().split("T")[0]),
    CLIENTE1: (expediente.cliente || "").toUpperCase(),
    CLIENTE: expediente.cliente || "",
    DIRECCION: expediente.direccion || "",
    DISTRITO: expediente.distrito || "",
    NIS: expediente.nis || "",
    NIA: expediente.nia || "",
    CARTA: primerDoc.numero_carta || "",
    ENSAYO: primerDoc.numero_informe || "",
    MUESTRA: primerDoc.numero_acta || "",
    ANEXO: tituloAnexo,
    PARAMETRO: tituloParametro,
    PE: String(expediente.precio_servicio),
  };

  const buffer = fillTemplate("PLANTILLA_PROPUESTA.docx", replacements);

  // Guardar en disco


  const filename = `Proforma_${expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

// ── Generar Carta de Programacion ─────────────────────────

async function generarProgramacion(expedienteId) {
  const { expediente, documentos } = await getDatosServicio(expedienteId);

  if (!expediente.fecha_programacion) {
    throw Object.assign(
      new Error("Debe registrar la fecha de programacion antes de generar la carta"),
      { status: 400 }
    );
  }

  const primerDoc = documentos[0] || {};

  const replacements = {
    FECHA: formatFechaLarga(new Date().toISOString().split("T")[0]),
    CLIENTE: expediente.cliente || "",
    DIRECCION: expediente.direccion || "",
    DISTRITO: expediente.distrito || "",
    NIS: expediente.nis || "",
    NIA: expediente.nia || "",
    CARTA: primerDoc.numero_carta || "",
    ENSAYO: primerDoc.numero_informe || "",
    MUESTRA: primerDoc.numero_acta || "",
    FPROGRA: formatFechaLarga(expediente.fecha_programacion),
  };

  const buffer = fillTemplate("PLANTILLA_PROGRAMACION.docx", replacements);

  // Guardar en disco


  const filename = `Programacion_${expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

// ── Generar Certificado ─────────────────────────

async function generarCertificado(expedienteId) {
  const { expediente } = await getDatosServicio(expedienteId);

  const hoy = peruNow();
  const tresMesesDespues = new Date(hoy);
  tresMesesDespues.setMonth(tresMesesDespues.getMonth() + 3);

  function formatDD(d) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  const replacements = {
    N: String(expedienteId).padStart(4, "0"),
    CLIENTE: expediente.cliente || "",
    DIRECCION: [expediente.direccion, expediente.distrito].filter(Boolean).join(", "),
    NIS: expediente.nis || "",
    FINICIO: formatDD(hoy),
    FFINAL: formatDD(tresMesesDespues),
  };

  const buffer = fillTemplate("CERTIFICADO_PLANTILLA.docx", replacements);



  const filename = `Certificado_${expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

// ── Generar Levantamiento ─────────────────────────

async function generarLevantamiento(expedienteId) {
  const { expediente } = await getDatosServicio(expedienteId);

  const docsResult = await query(
    `SELECT d.id, d.anexo, d.numero_acta, d.fecha_muestra
     FROM documentos d
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY d.anexo`, [expedienteId]
  );

  const paramsResult = await query(
    `SELECT rp.documento_id, cp.codigo, cp.nombre_completo
     FROM resultados_parametros rp
     JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
     JOIN documentos d ON rp.documento_id = d.id
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY cp.id`, [expedienteId]
  );

  const labResult = await query(
    `SELECT numero_informe FROM datos_laboratorio WHERE expediente_id = $1`, [expedienteId]
  );

  const docs = docsResult.rows;
  const a1Docs = docs.filter(d => d.anexo === "Anexo 1");
  const a2Docs = docs.filter(d => d.anexo === "Anexo 2");
  const ids1 = new Set(a1Docs.map(d => d.id));
  const ids2 = new Set(a2Docs.map(d => d.id));

  const params1 = paramsResult.rows.filter(r => ids1.has(r.documento_id));
  const params2 = paramsResult.rows.filter(r => ids2.has(r.documento_id));

  function joinParams(list, last) {
    if (list.length <= 1) return list.join("");
    return list.slice(0, -1).join(", ") + ` ${last} ` + list[list.length - 1];
  }

  let parametroText = "";
  if (a1Docs.length > 0 && a2Docs.length > 0) {
    const a1Names = joinParams(params1.map(p => p.codigo), "y");
    const a2Names = joinParams(params2.map(p => p.nombre_completo), "y");
    parametroText = `1 (${a1Names}) y Anexo 2 (${a2Names})`;
  } else if (a1Docs.length > 0) {
    parametroText = `1 (${joinParams(params1.map(p => p.codigo), "y")})`;
  } else if (a2Docs.length > 0) {
    parametroText = `2 (${joinParams(params2.map(p => p.nombre_completo), "y")})`;
  }

  const allParamTexts = [
    ...params1.map(p => p.codigo),
    ...params2.map(p => p.nombre_completo),
  ];
  const parametrosTexto = joinParams([...new Set(allParamTexts)], "y");

  const primerDoc = docs[0] || {};
  const fechaMuestra = primerDoc.fecha_muestra
    ? new Date(primerDoc.fecha_muestra).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";

  const hoy = peruNow();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","setiembre","octubre","noviembre","diciembre"];
  const fechaHoy = `${hoy.getDate()} DE ${meses[hoy.getMonth()].toUpperCase()} DE ${hoy.getFullYear()}`;
  function formatDD(d) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  let cuerpoanexo = "";
  if (a1Docs.length > 0 && a2Docs.length > 0) {
    cuerpoanexo = "Es un placer dirigirme a usted para saludarlo cordialmente y, a la vez, informarle que hemos adoptado las medidas correctivas sanitarias necesarias para solicitar la anulaci\u00f3n del cobro por exceso de concentraci\u00f3n correspondiente al Anexo 1, as\u00ed como la reapertura del servicio de agua y desag\u00fce conforme al Anexo 2.";
  } else if (a1Docs.length > 0) {
    cuerpoanexo = "Es un placer dirigirme a usted para saludarlo cordialmente y, a la vez, informarle que hemos adoptado las medidas correctivas sanitarias necesarias para solicitar la anulaci\u00f3n del cobro por exceso de concentraci\u00f3n correspondiente al Anexo 1.";
  } else if (a2Docs.length > 0) {
    cuerpoanexo = "Es un placer dirigirme a usted para saludarlo cordialmente y, a la vez, informarle que hemos adoptado las medidas correctivas sanitarias necesarias para solicitar la reapertura del servicio de agua y desag\u00fce conforme al Anexo 2.";
  }

  const replacements = {
    FECHAHOY: fechaHoy,
    CLIENTE: expediente.cliente || "",
    DIRECCION: [expediente.direccion, expediente.distrito].filter(Boolean).join(", "),
    NIS: expediente.nis || "",
    NIA: expediente.nia || "",
    NIENSAYO: labResult.rows[0]?.numero_informe || "",
    PARAMETRO: parametroText,
    TMUESTRA: primerDoc.numero_acta || "",
    FMUESTRA: fechaMuestra,
    PARAMETROSTEXTO: parametrosTexto,
    FINICIO: formatDD(hoy),
    CUERPOANEXO: cuerpoanexo,
  };

  const buffer = fillTemplate("PLANTILLA_LEVANTAMIENTO.docx", replacements);



  const filename = `Levantamiento_${expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

// ── Generar Ficha Tecnica ─────────────────────────

async function generarFichaTecnica(expedienteId) {
  const { expediente } = await getDatosServicio(expedienteId);

  const docsResult = await query(
    `SELECT d.id, d.anexo FROM documentos d
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY d.anexo`, [expedienteId]
  );

  const paramsResult = await query(
    `SELECT rp.documento_id, cp.codigo, cp.nombre_completo
     FROM resultados_parametros rp
     JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
     JOIN documentos d ON rp.documento_id = d.id
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY cp.id`, [expedienteId]
  );

  const docs = docsResult.rows;
  const a1Docs = docs.filter(d => d.anexo === "Anexo 1");
  const a2Docs = docs.filter(d => d.anexo === "Anexo 2");
  const ids1 = new Set(a1Docs.map(d => d.id));
  const ids2 = new Set(a2Docs.map(d => d.id));
  const params1 = paramsResult.rows.filter(r => ids1.has(r.documento_id));
  const params2 = paramsResult.rows.filter(r => ids2.has(r.documento_id));

  function joinParams(list, last) {
    if (list.length <= 1) return list.join("");
    return list.slice(0, -1).join(", ") + ` ${last} ` + list[list.length - 1];
  }

  let parametroText = "";
  if (a1Docs.length > 0 && a2Docs.length > 0) {
    parametroText = `1 (${joinParams(params1.map(p => p.codigo), "y")}) y Anexo 2 (${joinParams(params2.map(p => p.nombre_completo), "y")})`;
  } else if (a1Docs.length > 0) {
    parametroText = `1 (${joinParams(params1.map(p => p.codigo), "y")})`;
  } else if (a2Docs.length > 0) {
    parametroText = `2 (${joinParams(params2.map(p => p.nombre_completo), "y")})`;
  }

  const hoy = peruNow();
  function formatDD(d) {
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  const replacements = {
    N: String(expedienteId).padStart(4, "0"),
    CLIENTE: expediente.cliente || "",
    DIRECCION: [expediente.direccion, expediente.distrito].filter(Boolean).join(", "),
    NIS: expediente.nis || "",
    FINICIO: formatDD(hoy),
    PARAMETRO: parametroText,
  };

  const buffer = fillTemplate("PLANTILLA_FICHA_TECNICA.docx", replacements);



  const filename = `FichaTecnica_${expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

module.exports = {
  getDatosServicio,
  updateDatosServicio,
  getCalendario,
  generarProforma,
  generarProgramacion,
  generarCertificado,
  generarLevantamiento,
  generarFichaTecnica,
};
