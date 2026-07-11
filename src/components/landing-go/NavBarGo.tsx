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
        <div style={{ display: "flex", gap: 9 }}>
          <Link
            className="btn btn-borde"
            href="/login"
            style={{ padding: "9px 16px", fontSize: "13.5px" }}
          >
            Ingresar
          </Link>
          <CtaCupo
            origen="nav"
            className="btn btn-azul"
            style={{ padding: "9px 18px", fontSize: "13.5px" }}
          >
            Reserva tu cupo
          </CtaCupo>
        </div>
      </div>
    </nav>
  );
}
