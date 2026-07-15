import Image from "next/image";
import Link from "next/link";

/**
 * Nav con el logo real de Seiricon (icono transparente + wordmark + lema,
 * como el navbar del resto del sitio). Sin menú móvil (los enlaces se
 * ocultan en pantallas pequeñas, igual que el mockup aprobado).
 * Componente estático → Server Component.
 */
export default function NavBar() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="logo" href="/" aria-label="Seiricon — inicio">
          <Image src="/seiricon-icon.png" alt="" width={34} height={34} priority />
          <span className="logo-txt">
            SEIRICON
            <small>construyendo en orden</small>
          </span>
        </Link>
        <div className="nav-links">
          <a href="#producto">Producto</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#precios">Precios</a>
        </div>
        {/* el tamaño de estos botones vive en el CSS (.lv2 nav .btn): inline
            pisaría la compactación del breakpoint móvil */}
        <div style={{ display: "flex", gap: 9 }}>
          <Link className="btn btn-borde" href="/login">
            Ingresar
          </Link>
          <Link className="btn btn-azul" href="/registro">
            Empezar gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}
