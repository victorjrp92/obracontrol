import Image from "next/image";
import CtaCupoB2B from "./CtaCupoB2B";

/** Cierre navy con f5 (Medellín al atardecer) como textura sutil aspiracional. */
export default function Cierre() {
  return (
    <section className="cierre">
      <div className="wrap">
        <div className="cierre-in reveal">
          {/* textura f5, sutil */}
          <div className="cierre-tex" aria-hidden="true">
            <Image
              src="/landing/fotos/f5-medellin-atardecer.jpg"
              alt=""
              fill
              sizes="(max-width: 1140px) 100vw, 1084px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <h2>Tu próxima obra, bajo control desde el día uno</h2>
          <p>Estamos entrando por grupos para acompañar bien a cada constructora. Deja tu correo y te contactamos.</p>
          <CtaCupoB2B origen="cierre" className="btn btn-azul">
            Reserva tu cupo →
          </CtaCupoB2B>
        </div>
      </div>
    </section>
  );
}
