import Image from "next/image";
import Link from "next/link";
import CtaCupo from "./CtaCupo";

/**
 * Nav «Vivo/Aizome»: logo (icono real + wordmark con el badge GO y el lema) a
 * la izquierda; a la derecha "Ingresar" y el CTA pill "Reserva tu cupo" que
 * abre el ModalCupo con origen "nav". El tamaño del CTA vive en el CSS
 * (.lgo nav .btn) para no pisar la compactación del breakpoint de 520px.
 * Server Component: la interactividad vive en <CtaCupo/>.
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
        <div className="nav-der">
          <Link className="entrar" href="/login">
            Ingresar
          </Link>
          <CtaCupo origen="nav" className="btn btn-azul btn-chico">
            Reserva tu cupo
          </CtaCupo>
        </div>
      </div>
    </nav>
  );
}
