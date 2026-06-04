const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const { query } = require("../config/database");

const TEMPLATES_DIR = path.join(process.cwd(), "templates");

function peruNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function getInformeTecnicoData(expedienteId) {
  const expResult = await query(
    `SELECT e.id, e.estado, c.nombre AS cliente, c.direccion, c.distrito, c.nis, c.nia
     FROM expedientes e LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.id = $1`, [expedienteId]
  );
  if (expResult.rows.length === 0) throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });

  const docsResult = await query(
    `SELECT d.id, d.anexo FROM documentos d
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY d.anexo`, [expedienteId]
  );

  const antesResult = await query(
    `SELECT rp.resultado_valor, rp.documento_id, cp.id AS param_id, cp.codigo, cp.nombre_completo,
            cp.unidad, cp.expresion, cp.vma_normado
     FROM resultados_parametros rp
     JOIN catalogo_parametros cp ON rp.parametro_id = cp.id
     JOIN documentos d ON rp.documento_id = d.id
     WHERE d.expediente_id = $1 AND d.estado IN ('procesado','validado')
     ORDER BY cp.id`, [expedienteId]
  );

  const despuesResult = await query(
    `SELECT rl.resultado_valor, cp.id AS param_id, cp.codigo, cp.nombre_completo,
            cp.unidad, cp.expresion, cp.vma_normado
     FROM resultados_laboratorio rl
     JOIN catalogo_parametros cp ON rl.parametro_id = cp.id
     WHERE rl.expediente_id = $1
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

  const antes1 = antesResult.rows.filter(r => ids1.has(r.documento_id));
  const antes2 = antesResult.rows.filter(r => ids2.has(r.documento_id));
  const pIds1 = new Set(antes1.map(r => r.param_id));
  const pIds2 = new Set(antes2.map(r => r.param_id));
  const despues1 = despuesResult.rows.filter(r => pIds1.has(r.param_id));
  const despues2 = despuesResult.rows.filter(r => pIds2.has(r.param_id));

  return {
    expediente: expResult.rows[0],
    hasAnexo1: a1Docs.length > 0,
    hasAnexo2: a2Docs.length > 0,
    antes1, despues1, antes2, despues2,
    niEnsayo: labResult.rows[0]?.numero_informe || "",
    anexos: [a1Docs.length > 0 ? "1" : null, a2Docs.length > 0 ? "2" : null].filter(Boolean).join(" y "),
    parametrosTexto: [...new Set([...antes1, ...antes2].map(r => r.nombre_completo))].join(", "),
  };
}

function c(text, width, fill, color) {
  const f = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "";
  const co = color ? `<w:color w:val="${color}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${f}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/>${co}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:b/>${co}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p></w:tc>`;
}

function buildA1(params) {
  const H = "0070C0", W = "FFFFFF";
  let x = `<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/><w:tblW w:w="8200" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`;
  x += `<w:tblGrid><w:gridCol w:w="3600"/><w:gridCol w:w="1600"/><w:gridCol w:w="1500"/><w:gridCol w:w="1500"/></w:tblGrid>`;
  x += `<w:tr><w:trPr><w:trHeight w:val="340"/></w:trPr>`;
  x += c("Par\u00e1metro Excedido",3600,H,W)+c("Unidad de Medida",1600,H,W)+c("VMA Normado",1500,H,W)+c("Resultado Valor",1500,H,W);
  x += `</w:tr>`;
  params.forEach((p) => {
    x += `<w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr>`;
    x += c(p.nombre_completo||"",3600)+c(p.unidad||"mg/L",1600)+c(String(p.vma_normado||""),1500)+c(String(p.resultado_valor||""),1500);
    x += `</w:tr>`;
  });
  return x + `</w:tbl>`;
}

function buildA2(params) {
  const H = "0070C0", W = "FFFFFF";
  const lw = 1800;
  const pw = Math.floor((8925-lw)/Math.max(params.length,1));
  function row(label, vals, hdr) {
    let r = `<w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr>`;
    r += c(label,lw,hdr?H:null,hdr?W:null);
    vals.forEach(v => { r += c(v,pw,hdr?H:null,hdr?W:null); });
    return r + `</w:tr>`;
  }
  let x = `<w:tbl><w:tblPr><w:tblStyle w:val="Tablaconcuadrcula"/><w:tblW w:w="8925" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`;
  x += `<w:tblGrid><w:gridCol w:w="${lw}"/>`;
  params.forEach(() => { x += `<w:gridCol w:w="${pw}"/>`; });
  x += `</w:tblGrid>`;
  x += row("Par\u00e1metro", params.map(p=>p.nombre_completo||""), true);
  x += row("Unidad de medida", params.map(p=>p.unidad||""), false);
  x += row("Expresi\u00f3n", params.map(p=>p.expresion||""), false);
  x += row("Valor VMA", params.map(p=>String(p.vma_normado||"")), false);
  x += row("Resultado", params.map(p=>String(p.resultado_valor||"")), false);
  return x + `</w:tbl>`;
}

function findAllTables(xml) {
  const results = [];
  const regex = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return results;
}

function findHeadingBefore(xml, tableStart, searchText) {
  const searchZone = xml.substring(Math.max(0, tableStart - 2000), tableStart);
  const paragraphs = [...searchZone.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (paragraphs[i][0].includes(searchText)) {
      const absStart = Math.max(0, tableStart - 2000) + paragraphs[i].index;
      return { start: absStart, end: absStart + paragraphs[i][0].length };
    }
  }
  return null;
}

async function generarInformeTecnico(expedienteId) {
  const data = await getInformeTecnicoData(expedienteId);
  const hoy = peruNow();
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","setiembre","octubre","noviembre","diciembre"];
  const fechaHoy = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const templatePath = path.join(TEMPLATES_DIR, "INFORME_TECNICO_PLANTILLA.docx");
  if (!fs.existsSync(templatePath)) throw Object.assign(new Error("Plantilla no encontrada"), { status: 500 });

  const zip = new PizZip(fs.readFileSync(templatePath));
  let xml = zip.file("word/document.xml").asText();

  const reps = {
    FECHAHOY: fechaHoy,
    CLIENTE: data.expediente.cliente || "",
    DIRECCION: [data.expediente.direccion, data.expediente.distrito].filter(Boolean).join(", "),
    NIS: data.expediente.nis || "",
    NIA: data.expediente.nia || "",
    NIENSAYO: data.niEnsayo,
    PARAMETROS: data.parametrosTexto,
    ANEXOS: data.anexos,
  };
  for (const [k, v] of Object.entries(reps)) {
    const e = esc(String(v));
    xml = xml.replace(new RegExp(`\\*\\*${k}\\*\\*`, "g"), e);
    xml = xml.replace(new RegExp(`\\*${k}\\*`, "g"), e);
  }

  const tables = findAllTables(xml);
  if (tables.length < 4) throw Object.assign(new Error("Plantilla invalida: se esperaban 4 tablas"), { status: 500 });

  const headings = [
    "antes del tratamiento",
    "despu",
    "antes del tratamiento",
    "despu",
  ];

  const replacements = [];

  if (data.hasAnexo1) {
    replacements.push({ tableIdx: 0, newTable: buildA1(data.antes1) });
    replacements.push({ tableIdx: 1, newTable: buildA1(data.despues1) });
  } else {
    replacements.push({ tableIdx: 0, newTable: "", removeHeading: true });
    replacements.push({ tableIdx: 1, newTable: "", removeHeading: true });
  }

  if (data.hasAnexo2) {
    replacements.push({ tableIdx: 2, newTable: buildA2(data.antes2) });
    replacements.push({ tableIdx: 3, newTable: buildA2(data.despues2) });
  } else {
    replacements.push({ tableIdx: 2, newTable: "", removeHeading: true });
    replacements.push({ tableIdx: 3, newTable: "", removeHeading: true });
  }

  replacements.sort((a, b) => b.tableIdx - a.tableIdx);

  for (const rep of replacements) {
    const tbl = tables[rep.tableIdx];
    let removeStart = tbl.start;
    let removeEnd = tbl.end;

    if (rep.removeHeading) {
      const heading = findHeadingBefore(xml, tbl.start, headings[rep.tableIdx]);
      if (heading) removeStart = heading.start;
    }

    xml = xml.substring(0, removeStart) + rep.newTable + xml.substring(removeEnd);
  }

  zip.file("word/document.xml", xml);
  const buffer = zip.generate({
    type: "nodebuffer",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const filename = `InformeTecnico_${data.expediente.nis || expedienteId}_${Date.now()}.docx`;

  return { filename, buffer };
}

module.exports = { generarInformeTecnico };
