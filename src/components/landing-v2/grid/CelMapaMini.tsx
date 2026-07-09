"use client";

import { gsap } from "gsap";
import MiniCursor from "./MiniCursor";
import { useLoopDemo, moverCursor } from "./useLoopDemo";

/**
 * Micro-demo del mapa multi-obra: silueta simple de Colombia con 3 ciudades →
 * zoom a Cali → aparecen 3 obras → el mini-cursor hace clic en una → chip de
 * detalle. Loop. La silueta es intencionalmente esquemática (ADN técnico).
 */
export default function CelMapaMini() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const vis = el.querySelector<HTMLElement>(".vis-mapa")!;
      const mundo = el.querySelector<HTMLElement>(".mm-mundo")!;
      const ciudades = Array.from(el.querySelectorAll<HTMLElement>(".mm-ciudad"));
      const pins = Array.from(el.querySelectorAll<HTMLElement>(".mm-pin"));
      const target = el.querySelector<HTMLElement>(".mm-target")!;
      const onda = el.querySelector<HTMLElement>(".mm-onda")!;
      const chip = el.querySelector<HTMLElement>(".mm-chip")!;
      const cur = el.querySelector<HTMLElement>(".mcur")!;

      // estado inicial de cada vuelta
      tl.set(mundo, { scale: 1, transformOrigin: "38% 49%" }, 0);
      tl.set(ciudades, { opacity: 0, scale: 0.3 }, 0);
      tl.set([...pins, chip, cur, onda], { opacity: 0 }, 0);
      tl.add(() => {
        cur.style.left = "76%";
        cur.style.top = "84%";
      }, 0);

      // aparecen las ciudades sobre el país
      tl.to(ciudades, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.5)", stagger: 0.15 }, 0.3);

      // zoom a Cali; las ciudades ceden el lugar a las obras
      tl.to(mundo, { scale: 2.4, duration: 1.1, ease: "power2.inOut" }, 1.4);
      tl.to(ciudades, { opacity: 0, duration: 0.3, ease: "power1.in" }, 1.7);
      tl.to(pins, { opacity: 1, duration: 0.3, ease: "back.out(2.5)", stagger: 0.12 }, 2.5);

      // clic en una obra → detalle
      tl.add(() => {
        gsap.set(cur, { opacity: 1 });
        moverCursor(cur, target, vis);
      }, 3.0);
      tl.fromTo(
        onda,
        { scale: 0.4, opacity: 0.7 },
        { scale: 1.9, opacity: 0, duration: 0.5, ease: "power1.out", immediateRender: false },
        3.85
      );
      tl.fromTo(
        chip,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false },
        4.05
      );

      // se deja leer y se recoge todo
      tl.to([chip, ...pins, cur], { opacity: 0, duration: 0.4, ease: "power1.in" }, 6.3);
      tl.to(mundo, { scale: 1, duration: 0.6, ease: "power2.inOut" }, 6.35);
    },
    (el) => el.querySelector(".vis-mapa")?.classList.add("fin"),
    0.5
  );

  return (
    <div className="cel reveal" ref={ref} style={{ transitionDelay: ".06s" }}>
      <div className="vis vis-mapa" aria-hidden="true">
        <div className="mm-centro">
          <div className="mm-mundo">
            {/* silueta simple de Colombia */}
            <svg className="mm-col" viewBox="0 0 100 130" aria-hidden="true">
              <path d="M62 4 L68 10 L64 16 L57 22 L60 30 L70 40 L78 52 L84 66 L78 74 L74 86 L62 92 L58 104 L54 122 L47 102 L42 96 L34 92 L36 80 L30 68 L26 56 L28 44 L27 30 L36 20 L48 12 Z" />
            </svg>
            {/* Medellín · Bogotá · Cali */}
            <span className="mm-ciudad" style={{ left: "42%", top: "29%" }}></span>
            <span className="mm-ciudad" style={{ left: "52%", top: "38%" }}></span>
            <span className="mm-ciudad" style={{ left: "38%", top: "49%" }}></span>
          </div>
        </div>
        <div className="mm-obras">
          <span className="mm-pin" style={{ left: "30%", top: "34%", background: "var(--verde)" }}></span>
          <span className="mm-pin" style={{ left: "60%", top: "52%", background: "var(--azul)" }}></span>
          <span className="mm-pin mm-target" style={{ left: "44%", top: "70%", background: "var(--ambar)", color: "var(--ambar)" }}>
            <i className="mm-onda"></i>
          </span>
          <span className="mm-chip">Torre Alameda · 71%</span>
        </div>
        <MiniCursor />
      </div>
      <h4>Mapa multi-obra</h4>
      <p>Todas tus obras en un mapa con su avance. La ronda de llamadas, jubilada.</p>
    </div>
  );
}
