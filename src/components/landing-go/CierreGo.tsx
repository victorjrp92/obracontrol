import Image from "next/image";
import RelojesGo from "./RelojesGo";
import CtaCupo from "./CtaCupo";
import Particulas from "./Particulas";

/**
 * Cierre nocturno: los relojes vuelven (esta instancia arranca en Nueva
 * York, como el mockup), el eco emocional, partículas de fondo y la foto
 * payoff de la pareja estrenando casa. CTA final: lista de espera.
 */
export default function CierreGo() {
  return (
    <section className="cierre">
      <Particulas cantidad={60} color="#ffffff" />
      <div className="wrap cierre-grid">
        <div className="reveal">
          <RelojesGo inicial={1} />
          <h2>Tu obra te está esperando.</h2>
          <p className="eco">Está allá, avanzando con o sin tus ojos. Mejor con ellos.</p>
          <CtaCupo origen="cierre">Reserva tu cupo</CtaCupo>
          <div className="micro">Primera obra gratis · Sin tarjeta</div>
        </div>
        <div className="cierre-foto reveal">
          <Image
            src="/landing/fotos/go-pareja-casa.jpg"
            alt="Pareja estrenando su casa"
            fill
            sizes="(max-width: 900px) 100vw, 40vw"
          />
        </div>
      </div>
    </section>
  );
}
