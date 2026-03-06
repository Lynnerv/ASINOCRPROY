/**
 * Página para restablecer contraseña (HU-02, pasos 2 y 3).
 *
 * URL: /restablecer/:token
 *
 * Flujo:
 *   1. Al montar: verifica el token con el backend
 *   2. Si válido: muestra formulario "Crear nueva contraseña"
 *   3. Si inválido/expirado: muestra mensaje de error
 *
 * Política de contraseña:
 *   - Mínimo 8 caracteres
 *   - Al menos 1 número
 *   - Al menos 1 letra mayúscula
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, XCircle, Loader } from "lucide-react";
import { authApi } from "../api/auth";
import "../styles/login.css";

function PasswordRule({ met, label }) {
  return (
    <div className={`pw-rule ${met ? "pw-met" : ""}`}>
      {met ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      <span>{label}</span>
    </div>
  );
}

export default function ResetPassword() {
  const { token } = useParams();

  // Token verification
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userName, setUserName] = useState("");

  // Form
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Policy checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const allValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  // Verify token on mount
  useEffect(() => {
    async function verify() {
      try {
        const { data } = await authApi.verifyResetToken(token);
        if (data.valid) {
          setTokenValid(true);
          setUserName(data.nombre);
        }
      } catch {
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    }
    verify();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!allValid) {
      setError("La contraseña no cumple con los requisitos");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading state ──
  if (verifying) {
    return (
      <div className="login-page">
        <div className="login-branding">
          <div className="branding-content">
            <div className="branding-logo">
              <img src="/logo.png" alt="Asin Solutions" className="branding-logo-img" />
              <span>ASIN SOLUTIONS</span>
            </div>
          </div>
        </div>
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="reset-verifying">
              <Loader size={24} className="spin" />
              <p>Verificando enlace...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Branding Panel */}
      <div className="login-branding">
        <div className="branding-content">
          <div className="branding-logo">
            <img src="/logo.png" alt="Asin Solutions" className="branding-logo-img" />
            <span>ASIN SOLUTIONS</span>
          </div>
          <h1>
            Gestión Documental
            <br />
            con <span className="highlight">Automatizada</span>
          </h1>
        </div>
      </div>

      {/* Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          {/* Token inválido */}
          {!tokenValid && (
            <div className="reset-invalid">
              <div className="reset-invalid-icon">
                <XCircle size={40} />
              </div>
              <h2>Enlace inválido</h2>
              <p className="subtitle">
                Este enlace de recuperación es inválido o ha expirado.
                Los enlaces son válidos por 1 hora.
              </p>
              <Link to="/recuperar" className="login-btn" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
                Solicitar nuevo enlace
              </Link>
            </div>
          )}

          {/* Éxito */}
          {tokenValid && success && (
            <div className="reset-sent">
              <div className="reset-sent-icon">
                <CheckCircle2 size={40} />
              </div>
              <h2>Contraseña actualizada</h2>
              <p className="subtitle">
                Tu contraseña ha sido restablecida exitosamente.
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link to="/login" className="login-btn" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
                Iniciar sesión
              </Link>
            </div>
          )}

          {/* Formulario */}
          {tokenValid && !success && (
            <>
              <h2>Crear nueva contraseña</h2>
              <p className="subtitle">
                Hola <strong>{userName}</strong>, ingresa tu nueva contraseña.
              </p>

              {error && (
                <div className="form-error">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="password">Nueva contraseña</label>
                  <div className="form-input-wrapper">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <Lock size={18} className="input-icon" />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Password policy */}
                <div className="pw-rules">
                  <PasswordRule met={hasMinLength} label="Mínimo 8 caracteres" />
                  <PasswordRule met={hasUppercase} label="Al menos 1 mayúscula" />
                  <PasswordRule met={hasNumber} label="Al menos 1 número" />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm">Confirmar contraseña</label>
                  <div className="form-input-wrapper">
                    <input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <Lock size={18} className="input-icon" />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <span className="pw-mismatch">Las contraseñas no coinciden</span>
                  )}
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading || !allValid}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Restableciendo...
                    </>
                  ) : (
                    "Restablecer contraseña"
                  )}
                </button>
              </form>
            </>
          )}

          <div className="login-footer">
            Asin Solutions © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
