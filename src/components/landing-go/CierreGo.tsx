import CtaCupo from "./CtaCupo";

/**
 * Cierre editorial «De obra»: texto gigante centrado sobre papel — "Tu obra te
 * está esperando." con "esperando." en azul plano, el eco emocional en Lora
 * itálica y el CTA final. Cierre tipográfico: se retiraron la foto de la
 * familia y las partículas del diseño «Cerca».
 */
export default function CierreGo() {
  return (
    <section className="cierre">
      <div className="wrap">
        <span className="fig">ÚLTIMO PLANO</span>
        <h2>
          Tu obra te está <em>esperando.</em>
        </h2>
        <p className="eco">Está allá, avanzando con o sin tus ojos. Mejor con ellos.</p>
        <CtaCupo origen="cierre" className="btn btn-azul">
          Reserva tu cupo
        </CtaCupo>
        <div className="micro">Primera obra gratis · Sin tarjeta</div>
      </div>
    </section>
  );
}
