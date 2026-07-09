import { FileSpreadsheet } from "lucide-react";
import VideoLoop from "./VideoLoop";

/**
 * FIG.02b — Arranque. Video real (v4) creando un proyecto con torres y
 * edificios. Copy v2.1 (opción A): la promesa es el RESULTADO — el presupuesto
 * que vive en Excel termina convertido en proyecto — sin explicar el mecanismo
 * de la plantilla (frases vetadas: "importa el Excel que ya tienes",
 * "llena nuestra plantilla").
 */
export default function SeccionCrearObra() {
  return (
    <section className="sec gris">
      <div className="wrap sec-grid">
        <div className="sec-copy reveal">
          <span className="mono" style={{ color: "var(--gris)", display: "block", marginBottom: 8 }}>
            FIG. 02b — ARRANQUE
          </span>
          <span className="eyebrow">Arranca en minutos</span>
          <h2>Tu presupuesto en Excel se convierte en proyecto</h2>
          <p className="txt">
            Define torres, pisos y tipos de apartamento con el asistente. Y el presupuesto que hoy
            vive en una hoja de cálculo termina dentro de Seiricon: tareas por fase, precios y
            cronograma, listos para asignar.
          </p>
          <div className="puntos">
            <span>Torres, pisos, unidades y espacios con un asistente guiado</span>
            <span>El presupuesto entra por Excel y sale convertido en tareas y cronograma</span>
            <span>Cada tarea nace con su fase, su precio y su plazo</span>
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
              label="Creación real de un proyecto con torres y edificios en Seiricon"
            />
          </div>
          <div className="insignia" style={{ left: -12, bottom: -18 }}>
            <span className="ic" style={{ background: "var(--verde)" }}>
              <FileSpreadsheet size={12} aria-hidden="true" />
            </span>{" "}
            De Excel a cronograma — en minutos
          </div>
        </div>
      </div>
    </section>
  );
}
