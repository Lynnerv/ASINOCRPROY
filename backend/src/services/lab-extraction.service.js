const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { query } = require("../config/database");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PROMPT = `Analiza este PDF de un informe de ensayo de laboratorio de aguas residuales.
Extrae UNICAMENTE los siguientes datos en formato JSON estricto (sin markdown, sin backticks):

{
  "numero_informe": "numero del informe de ensayo (solo el numero)",
  "fecha_analisis": "fecha de muestreo en formato YYYY-MM-DD",
  "laboratorio": "nombre del laboratorio",
  "parametros": [
    {
      "nombre": "nombre completo del parametro tal como aparece",
      "resultado": "valor numerico o texto exacto como aparece (ej: <10,0 o 79,9)"
    }
  ]
}

REGLAS:
- Solo extrae parametros de la seccion "I. Resultados" de la tabla "Tipo de Ensayo"
- El resultado debe ser el valor exacto de la columna "Resultados"
- Si el valor tiene "<" mantenlo (ej: "<10,0")
- No inventes datos. Si no encuentras un campo, pon null
- Responde SOLO con el JSON, sin texto adicional`;

async function extractLabReport(pdfPath) {
  const absolutePath = path.resolve(process.cwd(), pdfPath);
  const pdfBuffer = fs.readFileSync(absolutePath);
  const pdfBase64 = pdfBuffer.toString("base64");

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    },
    { text: PROMPT },
  ]);

  const responseText = result.response.text();
  const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function matchAndInsertParametros(expedienteId, parametros) {
  let inserted = 0;

  await query("DELETE FROM resultados_laboratorio WHERE expediente_id = $1", [expedienteId]);

  for (const p of parametros) {
    if (!p.nombre || p.resultado == null) continue;

    const nombreNorm = p.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    let parametroId = null;

    const directMatch = await query(
      `SELECT id FROM catalogo_parametros
       WHERE LOWER(nombre_completo) ILIKE $1
          OR LOWER(expresion) ILIKE $1
       LIMIT 1`,
      [`%${nombreNorm}%`]
    );

    if (directMatch.rows.length > 0) {
      parametroId = directMatch.rows[0].id;
    } else {
      const keywords = nombreNorm.split(/\s+/).filter((w) => w.length > 3);
      for (const kw of keywords) {
        const retry = await query(
          `SELECT id FROM catalogo_parametros
           WHERE LOWER(nombre_completo) ILIKE $1
           LIMIT 1`,
          [`%${kw}%`]
        );
        if (retry.rows.length > 0) {
          parametroId = retry.rows[0].id;
          break;
        }
      }
    }

    if (parametroId) {
      await query(
        `INSERT INTO resultados_laboratorio (expediente_id, parametro_id, resultado_valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (expediente_id, parametro_id) DO UPDATE SET resultado_valor = $3`,
        [expedienteId, parametroId, String(p.resultado)]
      );
      inserted++;
    }
  }

  return inserted;
}

async function saveLabData(expedienteId, extracted, pdfRuta) {
  const existing = await query(
    "SELECT id FROM datos_laboratorio WHERE expediente_id = $1",
    [expedienteId]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE datos_laboratorio SET
         numero_informe = $2,
         fecha_analisis = $3,
         laboratorio = $4,
         pdf_ruta = $5,
         actualizado_en = NOW()
       WHERE expediente_id = $1`,
      [
        expedienteId,
        extracted.numero_informe || null,
        extracted.fecha_analisis || null,
        extracted.laboratorio || null,
        pdfRuta || null,
      ]
    );
  } else {
    await query(
      `INSERT INTO datos_laboratorio
         (expediente_id, numero_informe, fecha_analisis, laboratorio, pdf_ruta)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        expedienteId,
        extracted.numero_informe || null,
        extracted.fecha_analisis || null,
        extracted.laboratorio || null,
        pdfRuta || null,
      ]
    );
  }

  const parametrosInsertados = await matchAndInsertParametros(
    expedienteId,
    extracted.parametros || []
  );

  return {
    numero_informe: extracted.numero_informe,
    parametros_extraidos: parametrosInsertados,
  };
}

async function processLabReport(expedienteId) {
  const evidencia = await query(
    `SELECT ruta_archivo FROM evidencias_expediente
     WHERE expediente_id = $1 AND tipo = 'informe_laboratorio'
     ORDER BY creado_en DESC LIMIT 1`,
    [expedienteId]
  );

  if (evidencia.rows.length === 0) {
    throw Object.assign(new Error("No se encontro el PDF del informe de laboratorio"), { status: 400 });
  }

  const pdfRuta = evidencia.rows[0].ruta_archivo;
  const extracted = await extractLabReport(pdfRuta);
  return await saveLabData(expedienteId, extracted, pdfRuta);
}

module.exports = { processLabReport, extractLabReport, saveLabData };
