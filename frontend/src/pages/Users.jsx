/**
 * Gestión de Usuarios (HU-03, solo administrador).
 *
 * CRUD: listar, crear, editar, activar/desactivar, reset password.
 */

import { useState, useEffect } from "react";
import { usersApi } from "../api/documents";
import {
  UserPlus, Edit2, Key, X, Loader, CheckCircle2, XCircle,
} from "lucide-react";
import "../styles/users.css";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit'|'password', user? }
  const [form, setForm] = useState({ nombre: "", correo: "", password: "", rol: "operador" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await usersApi.list();
      setUsers(data.usuarios);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm({ nombre: "", correo: "", password: "", rol: "operador" });
    setMsg(null);
    setModal({ mode: "create" });
  }

  function openEdit(user) {
    setForm({ nombre: user.nombre, correo: user.correo, rol: user.rol });
    setMsg(null);
    setModal({ mode: "edit", user });
  }

  function openPassword(user) {
    setForm({ password: "" });
    setMsg(null);
    setModal({ mode: "password", user });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      if (modal.mode === "create") {
        await usersApi.create(form);
        setMsg({ type: "success", text: "Usuario creado exitosamente" });
      } else if (modal.mode === "edit") {
        await usersApi.update(modal.user.id, form);
        setMsg({ type: "success", text: "Usuario actualizado" });
      } else if (modal.mode === "password") {
        await usersApi.resetPassword(modal.user.id, form.password);
        setMsg({ type: "success", text: "Contraseña actualizada" });
      }
      await loadUsers();
      setTimeout(() => setModal(null), 800);
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user) {
    try {
      await usersApi.update(user.id, { activo: !user.activo });
      await loadUsers();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  }

  if (loading) {
    return (
      <div className="users-page">
        <div className="users-loading"><Loader size={18} className="spin" /> Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="users-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p>Administra las cuentas y permisos del sistema</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <UserPlus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* Users table */}
      <div className="users-table-wrapper">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={!u.activo ? "row-inactive" : ""}>
                <td className="ut-name">{u.nombre}</td>
                <td className="ut-email">{u.correo}</td>
                <td>
                  <span className={`ut-role role-${u.rol}`}>{u.rol}</span>
                </td>
                <td>
                  <span className={`ut-active ${u.activo ? "active" : "inactive"}`}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="ut-date">
                  {u.ultimo_acceso
                    ? new Date(u.ultimo_acceso).toLocaleDateString("es-PE", {
                        day: "2-digit", month: "short", year: "numeric",
                      })
                    : "Nunca"}
                </td>
                <td>
                  <div className="ut-actions">
                    <button className="ut-btn" onClick={() => openEdit(u)} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className="ut-btn" onClick={() => openPassword(u)} title="Cambiar contraseña">
                      <Key size={14} />
                    </button>
                    <button
                      className={`ut-btn ${u.activo ? "ut-deactivate" : "ut-activate"}`}
                      onClick={() => toggleActive(u)}
                      title={u.activo ? "Desactivar" : "Activar"}
                    >
                      {u.activo ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="um-header">
              <h3>
                {modal.mode === "create" && "Nuevo Usuario"}
                {modal.mode === "edit" && "Editar Usuario"}
                {modal.mode === "password" && "Cambiar Contraseña"}
              </h3>
              <button className="um-close" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="um-form">
              {(modal.mode === "create" || modal.mode === "edit") && (
                <>
                  <div className="um-field">
                    <label>Nombre</label>
                    <input
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="um-field">
                    <label>Correo</label>
                    <input
                      type="email"
                      value={form.correo}
                      onChange={(e) => setForm({ ...form, correo: e.target.value })}
                      required
                    />
                  </div>
                  <div className="um-field">
                    <label>Rol</label>
                    <select
                      value={form.rol}
                      onChange={(e) => setForm({ ...form, rol: e.target.value })}
                    >
                      <option value="operador">Operador</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>
                </>
              )}

              {(modal.mode === "create" || modal.mode === "password") && (
                <div className="um-field">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              )}

              {msg && (
                <div className={`um-msg ${msg.type}`}>{msg.text}</div>
              )}

              <div className="um-actions">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
