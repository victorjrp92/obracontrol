import CtaCupo from "./CtaCupo";

/**
 * Sección de precio: una sola tarjeta con la única promesa comercial
 * aprobada — primera obra gratis, sin tarjeta. CTA: lista de espera.
 */
export default function PrecioGo() {
  return (
    <section id="precio" className="gris-suave">
      <div className="wrap">
        <div className="precio-card reveal">
          <span className="eyebrow">Precio</span>
          <h2>Tu primera obra es gratis.</h2>
          <p className="g1">
            Creas tu obra hoy y la llevas hasta el final sin pagar. Sin tarjeta, sin letra
            pequeña.
          </p>
          <p className="g2">
            Cuando necesites llevar más obras al tiempo, pasas a un plan pago. Así de simple.
          </p>
          <CtaCupo origen="precio">Reserva tu cupo</CtaCupo>
          <div className="micro">Primera obra gratis · Sin tarjeta</div>
        </div>
      </div>
    </section>
  );
}
