/**
 * Página de recuperación de contraseña (HU-02, paso 1).
 *
 * El usuario ingresa su correo y recibe un enlace de recuperación.
 * La respuesta es siempre positiva (no revela si el correo existe).
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "../api/auth";
import "../styles/login.css";

export default function ForgotPassword() {
  const [correo, setCorreo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!correo.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }

    setLoading(true);
    try {
      await authApi.requestPasswordReset(correo.trim());
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.detalles?.[0]?.mensaje ||
          "Error al procesar la solicitud"
      );
    } finally {
      setLoading(false);
    }
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
            con <span className="highlight">Inteligencia Artificial</span>
          </h1>
          <p>
            Sistema de extracción y validación automatizada de documentos
            de notificación mediante OCR y procesamiento con IA.
          </p>
        </div>
      </div>

      {/* Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          {!sent ? (
            <>
              <Link to="/login" className="back-link">
                <ArrowLeft size={16} />
                Volver al inicio de sesión
              </Link>

              <h2>Recuperar contraseña</h2>
              <p className="subtitle">
                Ingresa tu correo electrónico y te enviaremos un enlace para
                restablecer tu contraseña.
              </p>

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

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Enviando...
                    </>
                  ) : (
                    "Enviar enlace de recuperación"
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="reset-sent">
              <div className="reset-sent-icon">
                <CheckCircle2 size={40} />
              </div>
              <h2>Correo enviado</h2>
              <p className="subtitle">
                Si el correo <strong>{correo}</strong> está registrado en el
                sistema, recibirás un enlace de recuperación.
              </p>
              <p className="reset-sent-note">
                El enlace es válido por <strong>1 hora</strong>. Revisa tu
                bandeja de entrada y la carpeta de spam.
              </p>
              <Link to="/login" className="login-btn" style={{ textAlign: "center", textDecoration: "none", display: "block" }}>
                Volver al inicio de sesión
              </Link>
            </div>
          )}

          <div className="login-footer">
            Asin Solutions © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
