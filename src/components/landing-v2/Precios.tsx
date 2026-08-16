import Link from "next/link";
import CtaCupoB2B from "./CtaCupoB2B";

/**
 * Planes sin cifras, mientras la pasarela de pagos no esté viva.
 *
 * POR QUÉ: publicar $1.500.000/mes cuando no se puede cobrar es prometer algo
 * que el producto no puede cumplir todavía — y peor, fija un ancla que después
 * cuesta mover. Se conserva la ESTRUCTURA (qué incluye cada plan y hasta
 * cuántas obras), que es información real y útil para calificar al prospecto,
 * y el precio se conversa. Devolver las cifras es volver a poner el bloque
 * `.pr` con su valor: la maqueta y el CSS quedan intactos.
 */
export default function Precios() {
  return (
    <section className="precios" id="precios">
      <div className="wrap">
        <div className="denso-head reveal">
          <span className="eyebrow">Planes</span>
          <h2>Un plan para cada etapa</h2>
          <p className="precios-nota">
            Estamos entrando por grupos. Reserva tu cupo y armamos el plan según cuántas obras llevas.
          </p>
        </div>
        <div className="precios-grid">
          <div className="plan-d reveal">
            <h4>Obra</h4>
            <div className="pr">
              1 obra
              <small>hasta 150 unidades</small>
            </div>
            <ul>
              <li>Evidencia con aprobación</li>
              <li>Dashboard + semáforo</li>
              <li>Reportes de avance</li>
            </ul>
            <CtaCupoB2B origen="precio-obra" className="btn btn-borde">
              Reserva tu cupo
            </CtaCupoB2B>
          </div>
          <div className="plan-d destacado reveal" style={{ transitionDelay: ".06s" }}>
            <span className="rec">RECOMENDADO</span>
            <h4>Pro</h4>
            <div className="pr">
              Hasta 5 obras
              <small>el más pedido</small>
            </div>
            <ul>
              <li>Usuarios ilimitados</li>
              <li>Mapa de obras + alertas</li>
              <li>Soporte prioritario</li>
            </ul>
            <CtaCupoB2B origen="precio-pro" className="btn btn-azul">
              Reserva tu cupo
            </CtaCupoB2B>
          </div>
          <div className="plan-d reveal" style={{ transitionDelay: ".12s" }}>
            <h4>Empresa</h4>
            <div className="pr">
              Hasta 15 obras
              <small>varios equipos</small>
            </div>
            <ul>
              <li>Benchmarking entre obras</li>
              <li>Reportes PDF</li>
              <li>Onboarding asistido</li>
            </ul>
            <CtaCupoB2B origen="precio-empresa" className="btn btn-borde">
              Reserva tu cupo
            </CtaCupoB2B>
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
