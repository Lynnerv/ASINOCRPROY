const multer = require("multer");
const path = require("path");

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(
        new Error(`Formato no permitido: ${ext}. Solo se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}`),
        { status: 400 }
      ),
      false
    );
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
});

module.exports = { upload, ALLOWED_EXTENSIONS, MAX_FILE_SIZE };
