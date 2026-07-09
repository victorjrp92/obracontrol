"use client";

import { useLoopDemo } from "./useLoopDemo";

/** Los 5 niveles reales del semáforo de la app, con sus colores (globals.css). */
const NIVELES = [
  { nombre: "Adelantado", color: "#15803d" },
  { nombre: "A tiempo", color: "#22c55e" },
  { nombre: "Alerta", color: "#eab308" },
  { nombre: "Retraso", color: "#dc2626" },
  { nombre: "Crítico", color: "#7c2d12" },
];

/**
 * Micro-demo del semáforo de plazos: aparece cada nivel con su nombre, uno por
 * uno, luego los cinco puntos juntos con el texto de cierre. Loop.
 */
export default function CelSemaforo() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const niveles = Array.from(el.querySelectorAll<HTMLElement>(".sem-nivel"));
      const todos = el.querySelector<HTMLElement>(".sem-todos")!;
      const puntos = Array.from(el.querySelectorAll<HTMLElement>(".sem-puntos i"));

      // estado inicial de cada vuelta
      tl.set(niveles, { opacity: 0, y: 8 }, 0);
      tl.set(todos, { opacity: 0 }, 0);

      niveles.forEach((n, i) => {
        const t0 = 0.2 + i * 1.15;
        tl.to(n, { opacity: 1, y: 0, duration: 0.32, ease: "power3.out" }, t0);
        tl.to(n, { opacity: 0, y: -8, duration: 0.28, ease: "power2.in" }, t0 + 0.85);
      });

      const tTodos = 0.2 + NIVELES.length * 1.15 + 0.1;
      tl.fromTo(
        todos,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power3.out", immediateRender: false },
        tTodos
      );
      tl.fromTo(
        puntos,
        { scale: 0.3, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(2.5)", stagger: 0.07, immediateRender: false },
        tTodos
      );
      tl.to(todos, { opacity: 0, duration: 0.35, ease: "power1.in" }, tTodos + 2.5);
    },
    (el) => el.querySelector(".vis-sem")?.classList.add("fin"),
    0.3
  );

  return (
    <div className="cel reveal" ref={ref}>
      <div className="vis vis-sem">
        <div className="sem-fase" aria-hidden="true">
          {NIVELES.map((n) => (
            <span className="sem-nivel" key={n.nombre}>
              <i style={{ background: n.color }}></i>
              <b style={{ color: n.color }}>{n.nombre}</b>
            </span>
          ))}
        </div>
        <div className="sem-fase sem-todos" aria-hidden="true">
          <span className="sem-puntos">
            {NIVELES.map((n) => (
              <i key={n.nombre} style={{ background: n.color }}></i>
            ))}
          </span>
          <small>el riesgo se ve antes de que sea pérdida</small>
        </div>
      </div>
      <h4>Semáforo de plazos</h4>
      <p>Cinco niveles: adelantado, a tiempo, alerta, retraso, crítico. El riesgo se ve antes de que sea pérdida.</p>
    </div>
  );
}
