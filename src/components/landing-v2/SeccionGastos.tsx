import Image from "next/image";
import VideoLoop from "./VideoLoop";

/**
 * FIG.04 — El dinero. Video real (v2, regrabado): se registra un gasto en cámara
 * y luego la lista de gastos. El lenguaje es el mismo del dashboard de gastos
 * de la app ("¿Te están sustentando?", "No pagas sin factura"): la página
 * promete con las palabras con las que la app cumple. f3 (planos sobre la
 * mesa) entra RECORTADA como ambiente.
 */
export default function SeccionGastos() {
  return (
    <section className="sec gris">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 04 — EL DINERO
          </span>
          <span className="eyebrow">¿Te están sustentando?</span>
          <h2>Cada peso entregado, cruzado con su factura</h2>
          <p className="txt">
            Anticipos, facturas y presupuesto en un mismo lugar. Ves cuánto entregaste a cada
            contratista, cuánto está sustentado y qué falta por justificar en cada proyecto — sin
            hojas de cálculo sueltas.
          </p>
          <div className="puntos">
            <span>No pagas sin factura: lo no justificado aparece en rojo, al instante</span>
            <span>Anticipos y facturas ligados a cada proyecto</span>
            <span>Reportes de gasto listos para presentar</span>
          </div>
        </div>
        <div className="shot reveal-shot">
          <div className="shot-frame">
            <div className="shot-top">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <div className="shot-cap mono">
              <span>APP.SEIRICON.COM — GASTOS Y REPORTES</span>
              <span>CAPTURA SIN RETOQUE</span>
            </div>
            <VideoLoop
              src="/landing/videos/v2-gastos.mp4"
              poster="/landing/videos/v2-gastos-poster.jpg"
              label="Registro real de un gasto en Seiricon y la lista de gastos del proyecto"
            />
          </div>

          {/* f3 recortada — planos sobre la mesa, como ambiente */}
          <div
            className="foto-amb"
            aria-hidden="true"
            style={{ position: "absolute", right: -14, bottom: -20, width: 150, height: 108, lineHeight: 0 }}
          >
            <Image
              src="/landing/fotos/f3-planos-mesa.jpg"
              alt=""
              width={150}
              height={108}
              sizes="150px"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
