/**
 * Página de inicio de sesión.
 *
 * Layout split-screen: branding a la izquierda, formulario a la derecha.
 * Valida campos antes de enviar, muestra errores del backend.
 */

import { useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import "../styles/login.css";

export default function Login() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya está autenticado, redirigir al dashboard
  if (usuario) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validación local
    if (!correo.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña");
      return;
    }

    setLoading(true);
    try {
      await login(correo.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detalles?.[0]?.mensaje ||
        "Error de conexión con el servidor";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* --- Branding Panel --- */}
      <div className="login-branding">
        <div className="branding-content">
          <div className="branding-logo">
            <img src="/logo.png" alt="Asin Solutions" className="branding-logo-img" />
            <span>ASIN SOLUTIONS</span>
          </div>

          <h1>
            Gestión Documental
            <br />
            <span className="highlight">Automatizada</span>
          </h1>

          <p>
            Sistema de extracción y validación automatizada de documentos
            de notificación de Valores Máximos Admisibles.
          </p>

          <div className="branding-features">
            <div className="feature-item">
              <span className="feature-dot"></span>
              Extracción automática de datos de cartas
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              Validación de parámetros VMA en tiempo real
            </div>
            <div className="feature-item">
              <span className="feature-dot"></span>
              Generación automática de reportes y cartas poder
            </div>
          </div>
        </div>
      </div>

      {/* --- Form Panel --- */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <h2>Iniciar Sesión</h2>
          <p className="subtitle">Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="form-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="correo">Correo electrónico</label>
              <div className="form-input-wrapper">
                <input
                  id="correo"
                  type="email"
                  placeholder="usuario@asin.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
                <Mail size={18} className="input-icon" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="form-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <Lock size={18} className="input-icon" />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Verificando...
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <div className="forgot-link-wrapper">
            <Link to="/recuperar" className="forgot-link">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div className="login-footer">
            <div className="login-legal-links">
              <Link to="/legal/privacidad">Políticas de Privacidad</Link>
              <span>·</span>
              <Link to="/legal/terminos">Términos</Link>
              <span>·</span>
              <Link to="/legal/arco">Derechos ARCO</Link>
            </div>
            Asin Solutions © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
