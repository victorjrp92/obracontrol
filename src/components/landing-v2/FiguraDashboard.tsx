import VideoLoop from "./VideoLoop";

/**
 * FIG.01 — Dashboard del gerente. Video real (v1) dentro del marco "captura sin
 * retoque": barra mono identificadora + marcos de esquina + cotas flotantes.
 * Poster: shot-dashboard.png (se ve mientras el video no está en vista).
 */
export default function FiguraDashboard() {
  return (
    <section className="sec gris" id="producto">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 01 — CAPTURA SIN RETOQUE
          </span>
          <span className="eyebrow">Vista gerente</span>
          <h2>Toda la constructora en un tablero — este es el de verdad</h2>
          <p className="txt">
            No es una ilustración: así se ve Seiricon un martes cualquiera. Obras activas, tareas
            esperando tu aprobación, riesgo de retraso y progreso global.
          </p>
          <div className="puntos">
            <span>Semáforo de plazos en cada proyecto y cada tarea</span>
            <span>Mapa con todas tus obras y su avance</span>
            <span>Lo que requiere acción, arriba y de primero</span>
          </div>
        </div>
        <div className="shot reveal-shot esquinas">
          <div className="shot-frame">
            <div className="shot-top">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
            <div className="shot-cap mono">
              <span>APP.SEIRICON.COM — DASHBOARD GERENTE</span>
              <span>CAPTURA SIN RETOQUE</span>
            </div>
            <VideoLoop
              src="/landing/videos/v1-dashboard.mp4"
              poster="/landing/capturas/shot-dashboard.png"
              label="Recorrido real del dashboard del gerente en Seiricon: estadísticas, mapa de obras y tareas por aprobar"
            />
          </div>
          <span className="cota" style={{ right: -14, top: "26%" }}>
            ← MAPA DE OBRAS
          </span>
          <span className="cota" style={{ left: -14, bottom: "22%", animationDelay: "1.2s" }}>
            SEMÁFORO DE PLAZOS →
          </span>
        </div>
      </div>
    </section>
  );
}
