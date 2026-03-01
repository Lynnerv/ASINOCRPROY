/**
 * Middleware de autorización por rol.
 *
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse DESPUÉS del middleware de autenticación (auth.middleware).
 *
 * Uso:
 *   router.post("/usuarios", auth, authorize("administrador"), controller.crear);
 *   router.get("/docs", auth, authorize("administrador", "operador"), controller.listar);
 */

function authorize(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tiene permisos para esta acción" });
    }

    next();
  };
}

module.exports = authorize;
