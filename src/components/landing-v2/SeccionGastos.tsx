import Image from "next/image";
import VideoLoop from "./VideoLoop";

/**
 * La plata: gastos y reportes. Video real (v2) de las gráficas de gastos.
 * f3 (planos sobre la mesa) entra RECORTADA como ambiente — la foto trae texto
 * cirílico en los márgenes, así que se muestra con recorte centrado.
 */
export default function SeccionGastos() {
  return (
    <section className="sec gris">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 04 — LA PLATA
          </span>
          <span className="eyebrow">Control de plata</span>
          <h2>Cada peso entregado, cruzado con su factura</h2>
          <p className="txt">
            Anticipos, facturas y presupuesto en un mismo lugar. Ves cuánto entregaste a cada
            contratista, cuánto está sustentado y qué falta por justificar — sin hojas de cálculo
            sueltas.
          </p>
          <div className="puntos">
            <span>Anticipos y facturas ligados a cada obra</span>
            <span>Lo no justificado aparece en rojo, de una</span>
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
              label="Recorrido real de las gráficas de gastos y reportes en Seiricon"
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
