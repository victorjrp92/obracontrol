import Link from "next/link";

/** Precios claros en pesos — 4 planes del spec. 14 días gratis, sin tarjeta. */
export default function Precios() {
  return (
    <section className="precios" id="precios">
      <div className="wrap">
        <div className="denso-head reveal">
          <span className="eyebrow">Precios claros, en pesos</span>
          <h2>Un plan para cada etapa</h2>
        </div>
        <div className="precios-grid">
          <div className="plan-d reveal">
            <h4>Obra</h4>
            <div className="pr">
              $650.000
              <small>COP/mes · 1 obra activa</small>
            </div>
            <ul>
              <li>Hasta 150 unidades</li>
              <li>Evidencia con aprobación</li>
              <li>Dashboard + semáforo</li>
            </ul>
            <Link className="btn btn-borde" href="/registro">
              Empezar gratis
            </Link>
          </div>
          <div className="plan-d destacado reveal" style={{ transitionDelay: ".06s" }}>
            <span className="rec">RECOMENDADO</span>
            <h4>Pro</h4>
            <div className="pr">
              $1.800.000
              <small>COP/mes · hasta 5 obras</small>
            </div>
            <ul>
              <li>Usuarios ilimitados</li>
              <li>Mapa de obras + alertas</li>
              <li>Soporte prioritario</li>
            </ul>
            <Link className="btn btn-azul" href="/registro">
              Empezar gratis
            </Link>
          </div>
          <div className="plan-d reveal" style={{ transitionDelay: ".12s" }}>
            <h4>Empresa</h4>
            <div className="pr">
              $3.500.000
              <small>COP/mes · hasta 15 obras</small>
            </div>
            <ul>
              <li>Benchmarking entre obras</li>
              <li>Reportes PDF</li>
              <li>Onboarding asistido</li>
            </ul>
            <Link className="btn btn-borde" href="/registro">
              Empezar gratis
            </Link>
          </div>
          <div className="plan-d reveal" style={{ transitionDelay: ".18s" }}>
            <h4>Corporativo</h4>
            <div className="pr">
              A convenir
              <small>a tu medida</small>
            </div>
            <ul>
              <li>Más de 15 obras</li>
              <li>Integraciones a la medida</li>
              <li>Gerente de cuenta</li>
            </ul>
            <Link className="btn btn-borde" href="/contacto">
              Hablemos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
