/**
 * Middleware de autenticación JWT.
 *
 * Verifica que el request incluya un token JWT válido
 * en el header Authorization (formato: Bearer <token>).
 *
 * Si es válido, agrega req.usuario con los datos del token.
 * Si no, responde con 401.
 */

const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = {
      id: decoded.id,
      correo: decoded.correo,
      rol: decoded.rol,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = authMiddleware;
