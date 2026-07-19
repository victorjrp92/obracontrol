import Image from "next/image";
import CtaCupo from "./CtaCupo";

/**
 * Hero cinemático «De obra»: la foto de la obra al atardecer a pantalla
 * completa con un degradado noche (más oscuro abajo), un borde interior de
 * cotas con dos etiquetas mono, y abajo el contenido editorial: membrete mono,
 * H1 gigante Jost en mayúsculas ("como tú." en naranja), subtítulo Lora y el
 * CTA que abre el ModalCupo con origen "hero" (mismo mecanismo que CtaCupo).
 * El widget de kilómetros y la barra promo del diseño «Cerca» salieron. Server
 * Component: la interactividad del CTA vive en <CtaCupo/>.
 */
export default function HeroGo() {
  return (
    <header className="hero">
      <div className="hero-foto">
        <Image
          src="/landing/fotos/go-obra-atardecer.jpg"
          alt="Obras al atardecer, con una grúa al fondo"
          fill
          priority
          sizes="100vw"
        />
      </div>
      <div className="hero-cotas" aria-hidden="true">
        <span className="cota-a">OBRA № 001 — EN CURSO</span>
        <span className="cota-b">18:42 — LA OBRA SIGUE SIN TI</span>
      </div>
      <div className="wrap">
        <span className="mono memb">
          Seiricon Go — Control de obra para personas · Colombia
        </span>
        <h1 className="disp">
          Nadie cuida tu proyecto <em>como tú.</em>
        </h1>
        <p className="sub">
          Cada avance de tu obra te llega con foto, ubicación y hora — y tú lo apruebas desde tu
          celular, así estés a diez mil kilómetros.
        </p>
        <div className="hero-cta">
          <CtaCupo origen="hero" className="btn btn-naranja">
            Reserva tu cupo
          </CtaCupo>
          <span className="micro">Primera obra gratis · Sin tarjeta</span>
        </div>
      </div>
    </header>
  );
}
