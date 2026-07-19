import Image from "next/image";
import { Check, Clock, MapPin } from "lucide-react";

/**
 * "FIG. 01 — LA PRUEBA": el mismo avance del chat, ahora con pruebas. La
 * evidencia se muestra como una pieza de exhibición estilo polaroid (marco
 * blanco, ligeramente rotada, con el sello "Aprobado por ti" en la esquina y
 * los chips de GPS y hora en mono). Las filas de datos (tarea, quién reportó y
 * el registro) rematan la ficha.
 */
export default function LoQueCambia() {
  return (
    <section className="gris-suave">
      <div className="wrap exhibe-grid">
        <div className="sec-copy reveal">
          <span className="fig">FIG. 01 — LA PRUEBA</span>
          <span className="comparado">
            <Check className="ic" strokeWidth={2.6} aria-hidden="true" />
            La misma foto del chat — ahora con pruebas
          </span>
          <h2>El mismo avance. Ahora con pruebas.</h2>
          <p className="txt">
            Cada avance llega con foto, ubicación y hora tomadas en la obra. Tú lo miras y
            decides: apruebas o rechazas. Todo queda registrado con nombre y hora — qué se hizo,
            quién lo reportó y qué dijiste tú.
          </p>
        </div>
        <div className="pieza reveal">
          <span className="aprobado-sello">Aprobado por ti</span>
          <div className="pfoto">
            <Image
              src="/landing/fotos/f2-manos-panete.jpg"
              alt="El mismo avance del chat, ahora nítido y con pruebas"
              fill
              sizes="(max-width: 900px) 100vw, 440px"
            />
            <span className="chip chip-gps">
              <MapPin className="ic" strokeWidth={2.4} aria-hidden="true" />
              GPS: Cali — La Buitrera
            </span>
            <span className="chip chip-h">
              <Clock className="ic" strokeWidth={2.4} aria-hidden="true" />
              Hoy, 10:37 a. m.
            </span>
          </div>
          <div className="dato">
            <span className="mono">Tarea</span>
            <b>Pañete y estuco de fachada</b>
          </div>
          <div className="dato">
            <span className="mono">Reportó</span>
            <b>Don Álvaro — maestro</b>
          </div>
          <div className="dato">
            <span className="mono">Registro</span>
            <b>Con tu nombre y la hora</b>
          </div>
        </div>
      </div>
    </section>
  );
}
