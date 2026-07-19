import Image from "next/image";
import WidgetKm from "./WidgetKm";

/**
 * Hero «Cerca»: foto de la familia frente a su casa a pantalla completa con
 * un degradado noche (más oscuro a la izquierda) y, encima, en dos columnas:
 * a la izquierda el copy blanco (membrete lima, H1, subtítulo y la línea de
 * estrella ámbar) y a la derecha el <WidgetKm/> (la nueva expresión de la
 * distancia; el feed en vivo y los relojes salieron del hero). En móvil la
 * foto queda de fondo, el copy sobre el overlay y el widget debajo (CSS).
 */
export default function HeroGo() {
  return (
    <header className="hero">
      <div className="hero-foto">
        <Image
          src="/landing/fotos/go-familia-casa.jpg"
          alt="Una familia frente a la casa que están construyendo"
          fill
          priority
          sizes="100vw"
        />
      </div>
      <div className="wrap">
        <div className="hc">
          <span className="membrete">Seiricon Go — Control de obra para personas</span>
          <h1>Nadie cuida tu proyecto como tú.</h1>
          <p className="sub">
            Cada avance de tu obra te llega con foto, ubicación y hora — y tú lo apruebas desde tu
            celular, así estés a diez mil kilómetros.
          </p>
          <div className="estrellas">
            <svg className="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8-6.1-3.5-6.1 3.5 1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
            </svg>
            <span>
              <b>Hecho en Colombia</b> — para los que construyen lo suyo, estén donde estén
            </span>
          </div>
        </div>
        <WidgetKm />
      </div>
    </header>
  );
}
