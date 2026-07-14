import Image from "next/image";
import { ArrowRight } from "lucide-react";
import RelojesGo from "./RelojesGo";
import FeedVivo from "./FeedVivo";
import CtaCupo from "./CtaCupo";
import Particulas from "./Particulas";

/**
 * Hero de dos mundos: la foto nocturna (él, lejos, mirando el celular) a la
 * izquierda y el teléfono con el feed EN VIVO de su obra en Cali a la
 * derecha. Partículas blancas sobre la noche (luces de ciudad a lo lejos).
 * El copy flota encima con el membrete y el chip de relojes rotando.
 * CTA: lista de espera.
 */
export default function HeroGo() {
  return (
    <header className="hero">
      <div className="hero-grid">
        <div className="mundo-noche">
          <Image
            src="/landing/fotos/go-hero-noche.jpg"
            alt="Desde otro país, mirando su obra en el celular"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 47vw"
          />
          <Particulas className="particulas-noche" cantidad={90} color="#ffffff" />
        </div>
        <div className="mundo-dia">
          <FeedVivo />
        </div>
      </div>
      <div className="hero-copy">
        <div className="wrap">
          <div className="hc">
            <span className="membrete mono">
              Seiricon Go — Control de obra para personas · Colombia
            </span>
            <RelojesGo inicial={0} />
            <h1>Nadie cuida tu proyecto como tú.</h1>
            <p className="sub">
              Y ya no necesitas estar ahí para hacerlo. Cada avance te llega con foto, ubicación y
              hora — y tú lo apruebas desde tu celular, así estés a diez mil kilómetros.
            </p>
            <CtaCupo origen="hero">
              Reserva tu cupo
              <ArrowRight className="ic" strokeWidth={2.4} aria-hidden="true" />
            </CtaCupo>
            <div className="micro" style={{ color: "rgba(255,255,255,.55)" }}>
              Primera obra gratis · Sin tarjeta
            </div>
          </div>
        </div>
      </div>
      <span className="hero-cred">Foto: Julio Lopez · Unsplash</span>
    </header>
  );
}
