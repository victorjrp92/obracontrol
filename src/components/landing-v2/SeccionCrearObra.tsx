import VideoLoop from "./VideoLoop";

/**
 * "Tu obra en minutos / importa tu Excel" — video real (v4) creando una obra
 * con torres y edificios. Poster v4-crear-obra-poster.jpg.
 */
export default function SeccionCrearObra() {
  return (
    <section className="sec gris">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 02b — ARRANQUE
          </span>
          <span className="eyebrow">Tu obra en minutos</span>
          <h2>Crea la obra con sus torres — o importa el Excel que ya tienes</h2>
          <p className="txt">
            Defines torres, pisos y tipos de apartamento y el sistema arma la estructura completa.
            ¿Ya tienes el presupuesto en Excel? Súbelo y se convierte en tareas, fases y cronograma.
          </p>
          <div className="puntos">
            <span>Torres, pisos, unidades y espacios en un asistente</span>
            <span>Importa tu Excel de presupuesto tal como lo manejas</span>
            <span>Tareas por fase sugeridas, listas para asignar</span>
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
              <span>APP.SEIRICON.COM — NUEVA OBRA</span>
              <span>CAPTURA SIN RETOQUE</span>
            </div>
            <VideoLoop
              src="/landing/videos/v4-crear-obra.mp4"
              poster="/landing/videos/v4-crear-obra-poster.jpg"
              label="Creación real de una obra con torres y edificios en Seiricon"
            />
          </div>
          <div className="insignia" style={{ left: -12, bottom: -18 }}>
            <span className="ic" style={{ background: "var(--verde)" }}>
              ⇪
            </span>{" "}
            Importa tu Excel — sin volver a digitar
          </div>
        </div>
      </div>
    </section>
  );
}
