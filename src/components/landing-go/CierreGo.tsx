import Image from "next/image";
import CtaCupo from "./CtaCupo";
import Particulas from "./Particulas";

/**
 * Cierre nocturno «Cerca»: membrete lima con la promesa comercial, el eco
 * emocional, partículas de fondo sobre la noche y la foto payoff de la
 * familia frente a su casa de ladrillo (marco aspect 4/5). Los relojes
 * salieron de este bloque. CTA final: lista de espera.
 */
export default function CierreGo() {
  return (
    <section className="cierre">
      <Particulas cantidad={60} color="#ffffff" />
      <div className="wrap cierre-grid">
        <div className="reveal">
          <span className="membrete">Primera obra gratis · Sin tarjeta</span>
          <h2>Tu obra te está esperando.</h2>
          <p className="eco">Está allá, avanzando con o sin tus ojos. Mejor con ellos.</p>
          <CtaCupo origen="cierre">Reserva tu cupo</CtaCupo>
        </div>
        <div className="cierre-foto reveal">
          <Image
            src="/landing/fotos/go-familia-ladrillo.jpg"
            alt="Familia frente a su casa de ladrillo"
            fill
            sizes="(max-width: 900px) 100vw, 40vw"
          />
        </div>
      </div>
    </section>
  );
}
