import Image from "next/image";
import Link from "next/link";

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
          <p>14 días gratis, sin tarjeta. Crea tu obra o importa tu Excel — hoy mismo.</p>
          <Link className="btn btn-azul" href="/registro">
            Empezar gratis →
          </Link>
        </div>
      </div>
    </section>
  );
}
