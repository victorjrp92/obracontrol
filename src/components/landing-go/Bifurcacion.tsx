import { House, Link as LinkIcon } from "lucide-react";

/**
 * Bifurcación temprana bajo el hero: dos tarjetas-ancla que mandan al
 * propietario a la escena (#escena) y al contratista a su bloque
 * (#contratista). Son anclas de navegación, no CTAs de lista de espera.
 */
export default function Bifurcacion() {
  return (
    <div className="bifu">
      <div className="wrap bifu-grid">
        <a href="#escena" className="reveal">
          <b>
            <span className="pico p1">
              <House className="ic" size={17} strokeWidth={2.2} aria-hidden="true" />
            </span>
            Construyo o remodelo lo mío
          </b>
          <p>La casa que estás pagando tú, vista con tus propios ojos, estés donde estés.</p>
          <span className="flecha">Así funciona ↓</span>
        </a>
        <a href="#contratista" className="reveal">
          <b>
            <span className="pico p2">
              <LinkIcon className="ic" size={17} strokeWidth={2.2} aria-hidden="true" />
            </span>
            Manejo obras de clientes
          </b>
          <p>Eres maestro o remodelador y quieres clientes tranquilos que paguen sin pelear.</p>
          <span className="flecha">Tu parte está aquí ↓</span>
        </a>
      </div>
    </div>
  );
}
