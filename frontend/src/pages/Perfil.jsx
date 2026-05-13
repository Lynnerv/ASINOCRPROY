import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usersApi } from "../api/documents";
import {
  User, Mail, Shield, Clock, Save, Lock,
  Loader, CheckCircle, AlertCircle, X, Eye, EyeOff,
} from "lucide-react";
import "../styles/perfil.css";

export default function Perfil() {
  const { usuario } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data } = await usersApi.getProfile();
      setProfile(data.usuario);
      setNombre(data.usuario.nombre || "");
      setCorreo(data.usuario.correo || "");
    } catch (err) {
      console.error("Error cargando perfil:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setToast({ type: "error", message: "El nombre es obligatorio" });
      return;
    }
    if (!correo.trim() || !correo.includes("@")) {
      setToast({ type: "error", message: "Ingrese un correo valido" });
      return;
    }

    setSavingProfile(true);
    try {
      const { data } = await usersApi.updateProfile({ nombre: nombre.trim(), correo: correo.trim() });
      setProfile({ ...profile, ...data.usuario });
      setToast({ type: "success", message: "Datos actualizados correctamente" });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al actualizar los datos";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!passwordActual) {
      setToast({ type: "error", message: "Ingrese su contrasena actual" });
      return;
    }
    if (passwordNueva.length < 6) {
      setToast({ type: "error", message: "La nueva contrasena debe tener al menos 6 caracteres" });
      return;
    }
    if (passwordNueva !== passwordConfirm) {
      setToast({ type: "error", message: "Las contrasenas no coinciden" });
      return;
    }

    setSavingPassword(true);
    try {
      await usersApi.changePassword({ password_actual: passwordActual, password_nueva: passwordNueva });
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirm("");
      setToast({ type: "success", message: "Contrasena actualizada correctamente" });
    } catch (err) {
      const msg = err.response?.data?.error || "Error al cambiar la contrasena";
      setToast({ type: "error", message: msg });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-page">
        <div className="pf-loading"><Loader size={20} className="spin" /> Cargando perfil...</div>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <h1 className="pf-title">Mi perfil</h1>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="pf-grid">
        {/* Info card */}
        <div className="pf-card pf-info-card">
          <div className="pf-avatar">
            <User size={28} />
          </div>
          <h2 className="pf-info-name">{profile?.nombre}</h2>
          <span className="pf-info-role">{profile?.rol}</span>
          <div className="pf-info-details">
            <div className="pf-info-row">
              <Mail size={14} />
              <span>{profile?.correo}</span>
            </div>
            <div className="pf-info-row">
              <Shield size={14} />
              <span>{profile?.activo ? "Cuenta activa" : "Cuenta inactiva"}</span>
            </div>
            <div className="pf-info-row">
              <Clock size={14} />
              <span>
                {profile?.ultimo_acceso
                  ? `Ultimo acceso: ${new Date(profile.ultimo_acceso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "Sin accesos registrados"}
              </span>
            </div>
          </div>
        </div>

        {/* Forms column */}
        <div className="pf-forms">
          {/* Edit profile */}
          <div className="pf-card">
            <div className="pf-card-header">
              <h3>Datos personales</h3>
              <p>Actualiza tu nombre y correo electronico</p>
            </div>
            <div className="pf-card-body">
              <div className="pf-field">
                <label>Nombre completo</label>
                <div className="pf-input-wrap">
                  <User size={16} className="pf-input-icon" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre completo"
                  />
                </div>
              </div>
              <div className="pf-field">
                <label>Correo electronico</label>
                <div className="pf-input-wrap">
                  <Mail size={16} className="pf-input-icon" />
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>
              <button className="btn btn-primary pf-save-btn" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Guardar cambios
              </button>
            </div>
          </div>

          {/* Change password */}
          <div className="pf-card">
            <div className="pf-card-header">
              <h3>Cambiar contrasena</h3>
              <p>Ingresa tu contrasena actual para establecer una nueva</p>
            </div>
            <div className="pf-card-body">
              <div className="pf-field">
                <label>Contrasena actual</label>
                <div className="pf-input-wrap">
                  <Lock size={16} className="pf-input-icon" />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    placeholder="Ingresa tu contrasena actual"
                  />
                  <button className="pf-eye-btn" type="button" onClick={() => setShowPasswords(!showPasswords)}>
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="pf-field">
                <label>Nueva contrasena</label>
                <div className="pf-input-wrap">
                  <Lock size={16} className="pf-input-icon" />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    placeholder="Minimo 6 caracteres"
                  />
                </div>
              </div>
              <div className="pf-field">
                <label>Confirmar nueva contrasena</label>
                <div className="pf-input-wrap">
                  <Lock size={16} className="pf-input-icon" />
                  <input
                    type={showPasswords ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repite la nueva contrasena"
                  />
                </div>
                {passwordNueva && passwordConfirm && passwordNueva !== passwordConfirm && (
                  <span className="pf-field-error">Las contrasenas no coinciden</span>
                )}
              </div>
              <button className="btn btn-primary pf-save-btn" onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <Loader size={14} className="spin" /> : <Lock size={14} />}
                Cambiar contrasena
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
