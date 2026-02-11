/**
 * Layout principal de la aplicación.
 *
 * Envuelve todas las páginas protegidas con:
 * - Header fijo con logo, navegación y usuario
 * - Footer persistente
 *
 * Se renderiza en App.jsx alrededor de las rutas protegidas.
 */

import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import "../styles/layout.css";

const NAV_ITEMS = [
  { to: "/", label: "Inicio" },
  { to: "/cargar", label: "Cargar Cartas" },
  { to: "/procesar", label: "Procesar" },
  { to: "/expedientes", label: "Expedientes", disabled: true },
  { to: "/reportes", label: "Reportes", disabled: true },
];

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
              {NAV_ITEMS.map((item) => {
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
            <span>Sistema de Gestión Documental con IA</span>
          </div>
          <div className="footer-right">
            <span>Asin Solutions © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
