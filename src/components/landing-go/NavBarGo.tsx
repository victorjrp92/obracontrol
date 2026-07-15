import Image from "next/image";
import Link from "next/link";
import CtaCupo from "./CtaCupo";

/**
 * Nav de Seiricon Go: logo real (icono transparente) + wordmark con el badge
 * GO + lema, como el mockup. El CTA es la lista de espera (decisión del
 * founder: todos los CTAs abren el ModalCupo). Server Component: la
 * interactividad vive en <CtaCupo/>.
 */
export default function NavBarGo() {
  return (
    <nav>
      <div className="wrap nav-in">
        <Link className="logo" href="/" aria-label="Seiricon Go — inicio">
          <Image src="/seiricon-icon.png" alt="" width={30} height={30} priority />
          <span className="logo-txt">
            <span className="l1">
              SEIRICON<span className="go">GO</span>
            </span>
            <small>construyendo en orden</small>
          </span>
        </Link>
        {/* el tamaño de estos botones vive en el CSS (.lgo nav .btn): inline
            pisaba la compactación del breakpoint de 520px */}
        <div style={{ display: "flex", gap: 9 }}>
          <Link className="btn btn-borde" href="/login">
            Ingresar
          </Link>
          <CtaCupo origen="nav" className="btn btn-azul">
            Reserva tu cupo
          </CtaCupo>
        </div>
      </div>
    </nav>
  );
}
