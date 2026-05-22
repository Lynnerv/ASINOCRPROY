/**
 * Layout principal de la aplicación.
 *
 * Envuelve todas las páginas protegidas con:
 * - Header fijo con logo, navegación, campana y usuario
 * - Dark mode toggle
 * - Footer persistente
 */

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, User, Moon, Sun, AlertTriangle, Menu, X } from "lucide-react";
import Bell from "./Bell";
import "../styles/layout.css";

/**
 * Navegacion segun rol:
 *   admin    -> Inicio, Expedientes, Usuarios
 *   operador -> Inicio, Expedientes
 */
function getNavItems(rol) {
  const common = [
    { to: "/", label: "Inicio" },
    { to: "/expedientes", label: "Expedientes" },
    { to: "/estadisticas", label: "Estadisticas" },
  ];

  if (rol === "administrador") {
    return [...common, { to: "/usuarios", label: "Usuarios" }];
  }
  if (rol === "operador") {
    return common;
  }
  return [{ to: "/", label: "Inicio" }];
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("asin-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = getNavItems(usuario?.rol);

  const [theme, setTheme] = useState(getInitialTheme);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("asin-theme", theme); } catch {}
  }, [theme]);

  // Close modal with Escape key
  useEffect(() => {
    if (!showLogoutModal) return;
    function onKey(e) {
      if (e.key === "Escape") setShowLogoutModal(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showLogoutModal]);

  useEffect(() => { setMobileMenu(false); }, [location.pathname]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  function confirmLogout() {
    setShowLogoutModal(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      {/* ---- Header ---- */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            {usuario && (
              <button className="hamburger-btn" onClick={() => setMobileMenu(!mobileMenu)}>
                {mobileMenu ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
            <Link to="/" className="header-logo">
              <img src="/logo.png" alt="Asin Solutions" className="logo-img" />
              <span className="logo-text">ASIN SOLUTIONS</span>
            </Link>

            {usuario && (
              <nav className="header-nav">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;

                  if (item.disabled) {
                    return (
                      <span key={item.to} className="nav-link nav-disabled">
                        {item.label}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`nav-link ${isActive ? "nav-active" : ""}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="header-right">
            <button className="theme-toggle" onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {usuario ? (
              <>
                <Bell />
                <Link to="/perfil" className="header-user header-user-link">
                  <div className="user-avatar">
                    <User size={14} />
                  </div>
                  <div className="user-info">
                    <span className="user-name">{usuario.nombre}</span>
                    <span className="user-role">{usuario.rol}</span>
                  </div>
                </Link>
                <button className="logout-btn" onClick={() => setShowLogoutModal(true)} title="Cerrar sesión">
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <button className="logout-btn" onClick={() => navigate("/login")} title="Iniciar sesión">
                <User size={15} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenu && usuario && (
        <>
          <div className="mobile-overlay" onClick={() => setMobileMenu(false)}></div>
          <nav className="mobile-drawer">
            <div className="mobile-drawer-header">
              <div className="mobile-user-info">
                <div className="user-avatar"><User size={14} /></div>
                <div>
                  <span className="mobile-user-name">{usuario.nombre}</span>
                  <span className="mobile-user-role">{usuario.rol}</span>
                </div>
              </div>
            </div>
            <div className="mobile-drawer-links">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`mobile-link ${isActive ? "mobile-link-active" : ""}`}
                    onClick={() => setMobileMenu(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link to="/perfil" className={`mobile-link ${location.pathname === "/perfil" ? "mobile-link-active" : ""}`} onClick={() => setMobileMenu(false)}>
                Mi perfil
              </Link>
              <Link to="/notificaciones" className="mobile-link" onClick={() => setMobileMenu(false)}>
                Notificaciones
              </Link>
            </div>
            <div className="mobile-drawer-footer">
              <button className="mobile-logout" onClick={() => { setMobileMenu(false); setShowLogoutModal(true); }}>
                <LogOut size={16} /> Cerrar sesion
              </button>
            </div>
          </nav>
        </>
      )}

      {/* ---- Main Content ---- */}
      <main className="app-main">
        <div className="main-inner">{children}</div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-left">
            <img src="/logo.png" alt="Asin Solutions" className="footer-logo" />
            <span>ASIN SOLUTIONS</span>
            <span className="footer-sep">·</span>
            <span>Sistema de Gestión Documental</span>
          </div>
          <div className="footer-legal">
            <Link to="/legal/privacidad" className="footer-link">Políticas de Privacidad</Link>
            <span className="footer-sep">·</span>
            <Link to="/legal/terminos" className="footer-link">Términos y Condiciones</Link>
            <span className="footer-sep">·</span>
            <Link to="/legal/arco" className="footer-link">Derechos ARCO</Link>
          </div>
          <div className="footer-right">
            <span>Asin Solutions © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* ---- Logout confirmation modal ---- */}
      {showLogoutModal && (
        <div className="logout-modal-backdrop" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="logout-modal-icon">
              <AlertTriangle size={24} />
            </div>
            <h3 className="logout-modal-title">¿Cerrar sesión?</h3>
            <p className="logout-modal-text">
              Se cerrará tu sesión actual y volverás a la pantalla de inicio de sesión.
            </p>
            <div className="logout-modal-actions">
              <button className="logout-modal-btn logout-modal-cancel"
                onClick={() => setShowLogoutModal(false)}>
                Cancelar
              </button>
              <button className="logout-modal-btn logout-modal-confirm" onClick={confirmLogout}>
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
