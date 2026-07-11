import Image from "next/image";
import { Check, Clock, MapPin } from "lucide-react";

/**
 * Sección "Así se ve con Seiricon Go": la MISMA foto del chat, ahora nítida
 * y con los chips de GPS y hora estampados — el contraste "el mismo avance,
 * ahora con pruebas".
 */
export default function LoQueCambia() {
  return (
    <section className="gris-suave">
      <div className="wrap sec-grid">
        <div className="reveal" style={{ order: 0 }}>
          <div className="avance avance-solo">
            <div className="avance-foto">
              <Image
                src="/landing/fotos/f2-manos-panete.jpg"
                alt="El mismo avance del chat, ahora nítido y con pruebas"
                fill
                sizes="(max-width: 900px) 100vw, 400px"
              />
              <span className="chip chip-gps on">
                <MapPin className="ic" strokeWidth={2.4} aria-hidden="true" />
                GPS: Cali — La Buitrera
              </span>
              <span className="chip chip-hora on">
                <Clock className="ic" strokeWidth={2.4} aria-hidden="true" />
                Hoy, 10:37 a. m.
              </span>
            </div>
            <div className="avance-body">
              <b>Pañete y estuco de fachada</b>
              <small>Esperando tu aprobación</small>
              <div className="avance-cta">
                <span className="b-ap">Aprobar</span>
                <span className="b-re">Rechazar</span>
              </div>
            </div>
          </div>
        </div>
        <div className="sec-copy reveal">
          <span className="comparado">
            <Check className="ic" strokeWidth={2.6} aria-hidden="true" />
            La misma foto del chat — ahora con pruebas
          </span>
          <span className="eyebrow" style={{ display: "block" }}>
            Así se ve con Seiricon Go
          </span>
          <h2>El mismo avance. Ahora con pruebas.</h2>
          <p className="txt">
            Cada avance llega con foto, ubicación y hora tomadas en la obra. Tú lo miras y
            decides: apruebas o rechazas. Todo queda registrado con nombre y hora — qué se hizo,
            quién lo reportó y qué dijiste tú.
          </p>
        </div>
      </div>
    </section>
  );
}
