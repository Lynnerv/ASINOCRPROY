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
import { LogOut, User, Moon, Sun } from "lucide-react";
import Bell from "./Bell";
import "../styles/layout.css";

/**
 * Navegación según rol:
 *   admin   → Inicio, Cargar, Procesar, Expedientes, Documentos, Reportes, Usuarios
 *   operador → Inicio, Cargar, Procesar, Expedientes, Documentos, Reportes
 */
function getNavItems(rol) {
  const common = [
    { to: "/", label: "Inicio" },
    { to: "/cargar", label: "Cargar Cartas" },
    { to: "/procesar", label: "Procesar" },
    { to: "/expedientes", label: "Expedientes" },
    { to: "/documentos", label: "Documentos" },
    { to: "/reportes", label: "Reportes", disabled: true },
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("asin-theme", theme); } catch {}
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      {/* ---- Header ---- */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <Link to="/" className="header-logo">
              <img src="/logo.png" alt="Asin Solutions" className="logo-img" />
              <span className="logo-text">ASIN SOLUTIONS</span>
            </Link>

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
          </div>

          <div className="header-right">
            <button className="theme-toggle" onClick={toggleTheme}
              title={theme === "dark" ? "Modo claro" : "Modo oscuro"}>
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <Bell />
            <div className="header-user">
              <div className="user-avatar">
                <User size={14} />
              </div>
              <div className="user-info">
                <span className="user-name">{usuario?.nombre}</span>
                <span className="user-role">{usuario?.rol}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

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
          <div className="footer-right">
            <span>Asin Solutions © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
