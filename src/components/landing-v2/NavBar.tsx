import Link from "next/link";

/**
 * Nav "ADN técnico": semáforo 🟢🟡🔴 como marca + wordmark SEIRICON.
 * Sin menú móvil (los enlaces se ocultan en pantallas pequeñas, igual que el
 * mockup aprobado). Componente estático → Server Component.
 */
export default function NavBar() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="logo" href="/nueva" aria-label="Seiricon — inicio">
          <span className="sem" aria-hidden="true">
            <i></i>
            <i></i>
            <i></i>
          </span>
          SEIRICON
        </Link>
        <div className="nav-links">
          <a href="#producto">Producto</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#precios">Precios</a>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <Link className="btn btn-borde" href="/login" style={{ padding: "9px 16px" }}>
            Ingresar
          </Link>
          <Link className="btn btn-azul" href="/registro" style={{ padding: "9px 18px" }}>
            Empezar gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}
