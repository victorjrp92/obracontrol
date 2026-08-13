"use client";

import { useLoopGo } from "./useLoopGo";

/** Filas del semáforo: estado + el porqué del color (días de atraso). */
const TAREAS = [
  { clase: "s-verde", n: "Vaciado de placa segundo piso", est: "A tiempo", dias: "al día" },
  { clase: "s-ambar", n: "Instalación eléctrica de cocina", est: "En riesgo", dias: "2 días de atraso" },
  { clase: "s-rojo", n: "Ventanería en aluminio", est: "Crítico", dias: "6 días de atraso" },
];

/**
 * Sección "El panorama": el semáforo por tarea — qué va bien, qué está en
 * riesgo y qué está crítico, con los días de atraso de cada una. Las filas
 * entran al cuadro una a una en loop (slide+fade, patrón FeedVivo vía
 * useLoopGo): quedan ~3s todas visibles, salen con fade y reinicia. Se pausa
 * fuera de viewport; reduced-motion = todas visibles estáticas.
 */
export default function Panorama() {
  const lista = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const filas = Array.from(el.querySelectorAll<HTMLElement>(".s-row"));
      const cont = el.querySelector(".sem-rows") as HTMLElement;

      tl.call(() => cont.classList.remove("fuera"), [], 0.05);
      filas.forEach((f, i) => tl.call(() => f.classList.add("on"), [], 0.55 + i * 0.7));
      // ~3s todas visibles → fade out → reset
      tl.call(() => cont.classList.add("fuera"), [], 5.5);
      tl.call(() => filas.forEach((f) => f.classList.remove("on")), [], 6.05);
      tl.to({}, { duration: 6.2 }, 0); // duración total del ciclo
    },
    (el) => el.querySelectorAll<HTMLElement>(".s-row").forEach((f) => f.classList.add("on")),
    0.5
  );

  return (
    <section className="panorama">
      <div className="wrap sec-grid">
        <div className="sem-lista reveal" style={{ order: 0 }} ref={lista}>
          <div className="mono" style={{ color: "var(--gris)", marginBottom: 10 }}>
            SEMÁFORO DE TU OBRA
          </div>
          <div className="sem-rows">
            {TAREAS.map((t) => (
              <div className={`s-row ${t.clase}`} key={t.n}>
                <span className="s-led"></span>
                <span className="s-tarea">{t.n}</span>
                <span className="s-est">
                  {t.est}
                  <small className="s-dias">{t.dias}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="sec-copy reveal">
          <span className="eyebrow">El panorama</span>
          <h2>Sabes qué va bien, qué está en riesgo y cuándo termina.</h2>
          <p className="txt">
            Un semáforo por tarea te avisa a tiempo. El cronograma trae duraciones sugeridas para
            que no arranques a ciegas, y cada tarea tiene su presupuesto. ¿Más de una obra? Todas
            en una sola pantalla.
          </p>
        </div>
      </div>
    </section>
  );
}
