import Link from "next/link";
import IlustracionCamino from "./IlustracionCamino";

/**
 * Los dos caminos de Juntos (spec): revisar una grieta o documentar los
 * daños. Cada tarjeta lleva su ilustración para que se entienda de un
 * vistazo qué va a hacer la persona, y la flecha del «Empezar» tiene un
 * empujón muy leve y espaciado — movimiento periférico que registra el
 * cerebro sin llamar la atención del ojo (pedido de Victor). Se apaga con
 * prefers-reduced-motion.
 */
export default function CaminosJuntos() {
  return (
    <section style={{ paddingBottom: 0 }}>
      <div className="wrap">
        <div className="jt-caminos-grid">
          <Link href="/go/juntos/revisar" className="jt-camino">
            <span className="num">Camino 1</span>
            <IlustracionCamino camino={1} />
            <b>Revisar una grieta</b>
            <p>
              Te decimos, foto a foto, con qué prioridad debería revisarla un profesional — y qué hacer
              mientras tanto.
            </p>
            <span className="flecha">
              Empezar <i className="flecha-punta" aria-hidden="true">→</i>
            </span>
          </Link>
          <Link href="/go/juntos/documentar" className="jt-camino">
            <span className="num">Camino 2</span>
            <IlustracionCamino camino={2} />
            <b>Documentar los daños</b>
            <p>
              Un acta de documentación de daños con fotos fechadas y ubicadas, espacio por espacio — para
              tu aseguradora y para solicitar ayudas del Estado.
            </p>
            <span className="flecha">
              Empezar <i className="flecha-punta" aria-hidden="true">→</i>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
