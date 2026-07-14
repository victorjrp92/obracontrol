import Image from "next/image";
import { Link as LinkIcon } from "lucide-react";
import PasoLinkDemo from "./PasoLinkDemo";
import PasoFotoDemo from "./PasoFotoDemo";
import PasoSistemaDemo from "./PasoSistemaDemo";

/**
 * Sección "La pregunta obligada": la objeción #1 del propietario ("¿y el
 * maestro qué tiene que hacer?") muere aquí — foto del obrero reportando y
 * los 3 pasos del link (sin app, sin cuenta, sin claves), cada uno con su
 * micro-demo animada en loop.
 */
export default function ObjecionMaestro() {
  return (
    <section>
      <div className="wrap maestro-grid">
        <figure className="maestro-foto reveal">
          <Image
            src="/landing/fotos/go-obrero-link.jpg"
            alt="Maestro de obra reportando desde el celular"
            fill
            sizes="(max-width: 900px) 100vw, 45vw"
          />
          <figcaption>
            <LinkIcon className="ic" strokeWidth={2.2} aria-hidden="true" />
            Abre el link. Toma la foto. Listo.
          </figcaption>
        </figure>
        <div className="sec-copy reveal">
          <span className="eyebrow">La pregunta obligada</span>
          <h2>¿Y el maestro qué tiene que hacer?</h2>
          <p className="txt">
            Abrir un link y tomar una foto. Eso es todo. Sin instalar nada, sin crear cuenta, sin
            claves. Si sabe mandar una foto por chat, ya sabe reportar en Seiricon Go.
          </p>
          <div className="pasos-link">
            <div className="paso-l">
              <div className="paso-cab">
                <span className="n">1</span>
                <div>
                  <b>Le llega el link</b>
                  <small>&ldquo;Reporta el avance de hoy aquí&rdquo;</small>
                </div>
              </div>
              <PasoLinkDemo />
            </div>
            <div className="paso-l">
              <div className="paso-cab">
                <span className="n">2</span>
                <div>
                  <b>Toma la foto del avance</b>
                  <small>El GPS y la hora se estampan solos</small>
                </div>
              </div>
              <PasoFotoDemo />
            </div>
            <div className="paso-l">
              <div className="paso-cab">
                <span className="n">3</span>
                <div>
                  <b>Entra al sistema</b>
                  <small>&ldquo;Avance enviado. Llega con tu nombre, la hora y la ubicación.&rdquo;</small>
                </div>
              </div>
              <PasoSistemaDemo />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
