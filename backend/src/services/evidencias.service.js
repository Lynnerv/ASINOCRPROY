/**
 * Servicio de Evidencias del Expediente (HU-11).
 *
 * Gestiona fotos de inoculación, fotos de monitoreo, informe de laboratorio
 * y el número de factura asociados a un expediente.
 */

const { query } = require("../config/database");
const fs = require("fs");
const path = require("path");

const EVIDENCIAS_REQUERIDAS = {
  foto_inoculacion: 4,
  foto_monitoreo: 4,
  informe_laboratorio: 1,
};

// Formato: E001- seguido de al menos 2 dígitos
const NUMERO_FACTURA_REGEX = /^E001-\d{2,}$/;

const TIPO_LABELS = {
  foto_inoculacion: "fotos de inoculación",
  foto_monitoreo: "fotos de monitoreo",
  informe_laboratorio: "informe de laboratorio",
};

/**
 * Obtiene el expediente + sus evidencias cargadas.
 */
async function getEvidencias(expedienteId) {
  const expResult = await query(
    `SELECT e.id, e.estado, e.numero_factura, e.cliente_id,
            c.nis, c.nombre AS cliente
     FROM expedientes e
     LEFT JOIN clientes c ON e.cliente_id = c.id
     WHERE e.id = $1`,
    [expedienteId]
  );
  if (expResult.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  const evResult = await query(
    `SELECT id, tipo, orden, ruta_archivo, nombre_archivo, tamano_bytes, creado_en
     FROM evidencias_expediente
     WHERE expediente_id = $1
     ORDER BY tipo, orden ASC NULLS LAST`,
    [expedienteId]
  );

  return {
    expediente: expResult.rows[0],
    evidencias: evResult.rows,
  };
}

/**
 * Agrega una evidencia. Si ya existe una con el mismo tipo+orden, la reemplaza
 * (elimina el archivo viejo y actualiza el registro).
 */
async function addOrReplaceEvidencia({ expedienteId, tipo, orden, file, userId }) {
  // Verificar expediente
  const exp = await query("SELECT id FROM expedientes WHERE id = $1", [expedienteId]);
  if (exp.rows.length === 0) {
    try { fs.unlinkSync(file.path); } catch {}
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  // Normalizar orden
  let ordenNum;
  if (tipo === "informe_laboratorio") {
    ordenNum = null;
  } else if (orden) {
    // Orden explícito (reemplazo de slot específico)
    ordenNum = parseInt(orden);
    if (!ordenNum || ordenNum < 1 || ordenNum > 4) {
      try { fs.unlinkSync(file.path); } catch {}
      throw Object.assign(new Error("El orden debe estar entre 1 y 4"), { status: 400 });
    }
  } else {
    // Sin orden: auto-asignar el primer slot disponible (1-4)
    const used = await query(
      `SELECT orden FROM evidencias_expediente
       WHERE expediente_id = $1 AND tipo = $2 AND orden IS NOT NULL
       ORDER BY orden ASC`,
      [expedienteId, tipo]
    );
    const usedOrdens = used.rows.map((r) => r.orden);
    ordenNum = null;
    for (let i = 1; i <= 4; i++) {
      if (!usedOrdens.includes(i)) {
        ordenNum = i;
        break;
      }
    }
    if (!ordenNum) {
      try { fs.unlinkSync(file.path); } catch {}
      throw Object.assign(
        new Error("Ya hay 4 fotos cargadas para este tipo. Elimina alguna antes de subir más."),
        { status: 400 }
      );
    }
  }

  // Buscar existente
  let existing;
  if (ordenNum) {
    existing = await query(
      `SELECT id, ruta_archivo FROM evidencias_expediente
       WHERE expediente_id = $1 AND tipo = $2 AND orden = $3`,
      [expedienteId, tipo, ordenNum]
    );
  } else {
    existing = await query(
      `SELECT id, ruta_archivo FROM evidencias_expediente
       WHERE expediente_id = $1 AND tipo = $2`,
      [expedienteId, tipo]
    );
  }

  const rutaNormalizada = file.path.replace(/\\/g, "/");

  // Reemplazar
  if (existing.rows.length > 0) {
    const oldPath = path.resolve(process.cwd(), existing.rows[0].ruta_archivo);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch {}
    }

    const result = await query(
      `UPDATE evidencias_expediente SET
         ruta_archivo = $1,
         nombre_archivo = $2,
         tamano_bytes = $3,
         subido_por = $4,
         creado_en = NOW()
       WHERE id = $5
       RETURNING id, tipo, orden, ruta_archivo, nombre_archivo, tamano_bytes, creado_en`,
      [rutaNormalizada, file.originalname, file.size, userId, existing.rows[0].id]
    );
    return result.rows[0];
  }

  // Insertar nuevo
  const result = await query(
    `INSERT INTO evidencias_expediente
       (expediente_id, tipo, orden, ruta_archivo, nombre_archivo, tamano_bytes, subido_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, tipo, orden, ruta_archivo, nombre_archivo, tamano_bytes, creado_en`,
    [expedienteId, tipo, ordenNum, rutaNormalizada, file.originalname, file.size, userId]
  );
  return result.rows[0];
}

/**
 * Elimina una evidencia (archivo + registro).
 */
async function deleteEvidencia(evidenciaId) {
  const result = await query(
    `SELECT ruta_archivo FROM evidencias_expediente WHERE id = $1`,
    [evidenciaId]
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error("Evidencia no encontrada"), { status: 404 });
  }

  const filePath = path.resolve(process.cwd(), result.rows[0].ruta_archivo);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch {}
  }

  await query(`DELETE FROM evidencias_expediente WHERE id = $1`, [evidenciaId]);
  return { deleted: true };
}

/**
 * Actualiza el número de factura del expediente.
 */
async function updateNumeroFactura(expedienteId, numeroFactura) {
  if (numeroFactura && !NUMERO_FACTURA_REGEX.test(numeroFactura)) {
    throw Object.assign(
      new Error("El N° de factura debe tener el formato E001-XX (por ejemplo: E001-10)"),
      { status: 400 }
    );
  }

  const result = await query(
    `UPDATE expedientes
     SET numero_factura = $2, actualizado_en = NOW()
     WHERE id = $1
     RETURNING id, numero_factura`,
    [expedienteId, numeroFactura || null]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  return result.rows[0];
}

/**
 * Valida que todas las evidencias requeridas estén cargadas y cambia el
 * estado del expediente a 'evidencias_cargadas'.
 */
async function guardarEvidencias(expedienteId, userId) {
  const exp = await query(
    `SELECT id, estado, numero_factura FROM expedientes WHERE id = $1`,
    [expedienteId]
  );
  if (exp.rows.length === 0) {
    throw Object.assign(new Error("Expediente no encontrado"), { status: 404 });
  }

  const numeroFactura = exp.rows[0].numero_factura;
  if (!numeroFactura || !NUMERO_FACTURA_REGEX.test(numeroFactura)) {
    throw Object.assign(
      new Error("Debe ingresar un N° de factura válido con formato E001-XX"),
      { status: 400 }
    );
  }

  const counts = await query(
    `SELECT tipo, COUNT(*)::int AS total
     FROM evidencias_expediente
     WHERE expediente_id = $1
     GROUP BY tipo`,
    [expedienteId]
  );

  const countMap = Object.fromEntries(counts.rows.map((r) => [r.tipo, r.total]));
  const faltantes = [];

  for (const [tipo, requerido] of Object.entries(EVIDENCIAS_REQUERIDAS)) {
    const actual = countMap[tipo] || 0;
    if (actual < requerido) {
      const missing = requerido - actual;
      faltantes.push(`Falta${missing > 1 ? "n" : ""} ${missing} ${TIPO_LABELS[tipo]}`);
    }
  }

  if (faltantes.length > 0) {
    throw Object.assign(new Error(faltantes.join(". ")), { status: 400 });
  }

  await query(
    `UPDATE expedientes
     SET estado = 'evidencias_cargadas', actualizado_en = NOW()
     WHERE id = $1`,
    [expedienteId]
  );

  await query(
    `INSERT INTO historial_acciones (usuario_id, accion, entidad, entidad_id)
     VALUES ($1, 'completar_evidencias', 'expedientes', $2)`,
    [userId, expedienteId]
  );

  return { success: true, expediente_id: expedienteId, estado: "evidencias_cargadas" };
}

module.exports = {
  getEvidencias,
  addOrReplaceEvidencia,
  deleteEvidencia,
  updateNumeroFactura,
  guardarEvidencias,
  reorderEvidencias,
  EVIDENCIAS_REQUERIDAS,
  NUMERO_FACTURA_REGEX,
};

/**
 * Reordena las evidencias de un tipo dentro de un expediente.
 * Recibe un array de IDs en el nuevo orden deseado; les asigna
 * orden = 1, 2, 3... según su posición.
 */
async function reorderEvidencias(expedienteId, tipo, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw Object.assign(new Error("Se requiere un array de IDs"), { status: 400 });
  }

  if (tipo !== "foto_inoculacion" && tipo !== "foto_monitoreo") {
    throw Object.assign(
      new Error("Solo se pueden reordenar fotos de inoculación o monitoreo"),
      { status: 400 }
    );
  }

  // Verificar que todos los IDs pertenezcan al expediente y tipo
  const check = await query(
    `SELECT id FROM evidencias_expediente
     WHERE expediente_id = $1 AND tipo = $2 AND id = ANY($3::int[])`,
    [expedienteId, tipo, ids]
  );

  if (check.rows.length !== ids.length) {
    throw Object.assign(
      new Error("Algunos IDs no pertenecen a este expediente o tipo"),
      { status: 400 }
    );
  }

  // Asignar nuevo orden basado en posición en el array
  for (let i = 0; i < ids.length; i++) {
    await query(
      `UPDATE evidencias_expediente SET orden = $1 WHERE id = $2`,
      [i + 1, ids[i]]
    );
  }

  return { reordered: true };
}
