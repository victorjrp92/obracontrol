import { HardHat } from "lucide-react";

/**
 * Testimonio — PLACEHOLDER marcado. Se reemplaza cuando haya testimonio real de
 * un beta tester (el contrato del beta incluye caso de éxito). Nada inventado.
 */
export default function Testimonio() {
  return (
    <section className="testi-d" style={{ paddingBottom: 44 }}>
      <div className="wrap">
        <div className="testi-caja reveal">
          <span className="av" aria-hidden="true">
            <HardHat size={26} />
          </span>
          <div>
            <span className="testi-nota">Espacio para beta tester</span>
            <blockquote>
              &ldquo;Antes cruzaba la ciudad dos veces al día para ver si la obra avanzaba. Ahora lo
              veo con fotos y GPS desde la oficina — y voy a la obra cuando yo decido.&rdquo;
            </blockquote>
            <cite>Testimonio de ejemplo · pendiente de beta tester real · Directora de obra, Cali</cite>
          </div>
        </div>
      </div>
    </section>
  );
}
