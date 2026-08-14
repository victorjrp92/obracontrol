import Link from "next/link";

/**
 * Los dos caminos de Juntos (spec): revisar una grieta o documentar los
 * daños. Tarjetas pastel-ancla con la sombra dura al hover (patrón del
 * índice de /go).
 */
export default function CaminosJuntos() {
  return (
    <section style={{ paddingBottom: 0 }}>
      <div className="wrap">
        <div className="jt-caminos-grid">
          <Link href="/go/juntos/revisar" className="jt-camino">
            <span className="num">Camino 1</span>
            <b>Revisar una grieta</b>
            <p>
              Te decimos, foto a foto, con qué prioridad debería revisarla un profesional — y qué hacer
              mientras tanto.
            </p>
            <span className="flecha">Empezar →</span>
          </Link>
          <Link href="/go/juntos/documentar" className="jt-camino">
            <span className="num">Camino 2</span>
            <b>Documentar los daños</b>
            <p>
              Un acta de documentación de daños con fotos fechadas y ubicadas, espacio por espacio — para
              tu aseguradora y para pedir ayuda.
            </p>
            <span className="flecha">Empezar →</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
