import CtaCupo from "./CtaCupo";
import HeroDemoGo from "./HeroDemoGo";

/**
 * Hero «Vivo/Aizome»: titular con los dos marcadores del mockup ("tu proyecto"
 * en navy, "tú." en índigo, ambos con borde tinta y sombra dura), el subtítulo,
 * el CTA pill que abre el ModalCupo con origen "hero" y, debajo, la demo
 * animada de la pantalla "Proyectos" (<HeroDemoGo/>) — la estrella de la
 * página. Server Component: la interactividad vive en <CtaCupo/> y en la demo.
 */
export default function HeroGo() {
  return (
    <header className="hero">
      <div className="wrap">
        <h1>
          Nadie cuida <span className="marca">tu proyecto</span>
          <br />
          como <span className="marca v2">tú.</span>
        </h1>
        <p className="sub">
          Cada avance de tu obra te llega con foto, ubicación y hora — y tú lo apruebas desde tu
          celular, aunque estés a diez mil kilómetros.
        </p>
        <div className="hero-cta">
          <CtaCupo origen="hero" className="btn btn-azul">
            Reserva tu cupo
          </CtaCupo>
        </div>
        <div className="micro">Primera obra gratis · Sin tarjeta</div>
      </div>
      <HeroDemoGo />
    </header>
  );
}
