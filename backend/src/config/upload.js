/**
 * Configuración de Multer para carga de archivos.
 *
 * Reglas (HU-04):
 *   - Formatos permitidos: JPG, JPEG, PNG
 *   - Tamaño máximo por archivo: 5 MB
 *   - Almacenamiento: disco local /uploads/{año}/{mes}/
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Extensiones permitidas
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Almacenamiento en disco con estructura por fecha
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const dir = path.join(process.cwd(), "uploads", String(year), month);

    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Formato: timestamp_nombreOriginal
    const timestamp = Date.now();
    const sanitized = file.originalname
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${sanitized}`);
  },
});

// Filtro de tipo de archivo
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(
        new Error(
          `Formato no permitido: ${ext}. Solo se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}`
        ),
        { status: 400 }
      ),
      false
    );
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20, // Máximo 20 archivos por request
  },
});

module.exports = { upload, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
