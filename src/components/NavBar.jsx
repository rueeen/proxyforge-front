import { NavLink } from "react-router-dom";
import "./NavBar.css";

export default function NavBar() {
  return (
    <header className="navbar">
      <nav className="navbar-inner" aria-label="Navegación principal">
        <NavLink className="brand" to="/" aria-label="ProxyForge, inicio">
          <span className="brand-mark">PF</span>
          <span>ProxyForge</span>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>Mis mazos</NavLink>
          <NavLink to="/importar">Importar mazo</NavLink>
        </div>
      </nav>
    </header>
  );
}
