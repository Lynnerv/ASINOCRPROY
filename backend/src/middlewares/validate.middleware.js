/**
 * Middleware de validación de requests.
 *
 * Centraliza la verificación de los resultados de express-validator.
 * Se usa como último eslabón en la cadena de validación.
 *
 * Uso en rutas:
 *   const { body } = require("express-validator");
 *
 *   router.post("/login",
 *     body("correo").isEmail(),
 *     body("password").notEmpty(),
 *     validate,
 *     controller.login
 *   );
 */

const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      detalles: errors.array().map((e) => ({
        campo: e.path,
        mensaje: e.msg,
      })),
    });
  }

  next();
}

module.exports = validate;
