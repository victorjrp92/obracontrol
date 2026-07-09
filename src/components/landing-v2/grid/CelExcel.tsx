"use client";

import { Check } from "lucide-react";
import MiniCursor from "./MiniCursor";
import { useLoopDemo, moverCursor } from "./useLoopDemo";

/**
 * Micro-demo "De Excel a proyecto": el mini-cursor hace clic en Importar, se
 * abre un selector de archivos estilo macOS con la plantilla seleccionada,
 * clic en Abrir → check verde + tag XLSX → PROYECTO. Loop.
 */
export default function CelExcel() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const vis = el.querySelector<HTMLElement>(".vis-excel")!;
      const btn = el.querySelector<HTMLElement>(".xbtn")!;
      const win = el.querySelector<HTMLElement>(".xwin")!;
      const abrir = el.querySelector<HTMLElement>(".xabrir")!;
      const check = el.querySelector<HTMLElement>(".xcheck")!;
      const tag = el.querySelector<HTMLElement>(".xtag")!;
      const cur = el.querySelector<HTMLElement>(".mcur")!;

      // estado inicial de cada vuelta
      tl.set(btn, { opacity: 1, scale: 1 }, 0);
      tl.set(win, { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" }, 0);
      tl.set([check, tag], { opacity: 0 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        cur.style.left = "18%";
        cur.style.top = "84%";
      }, 0);

      // el cursor va al botón Importar y hace clic
      tl.to(cur, { opacity: 1, duration: 0.25 }, 0.25);
      tl.add(() => moverCursor(cur, btn, vis), 0.35);
      tl.to(btn, { scale: 0.93, duration: 0.09, yoyo: true, repeat: 1 }, 1.25);

      // se abre el selector de archivos estilo macOS
      tl.to(btn, { opacity: 0, duration: 0.2 }, 1.45);
      tl.fromTo(
        win,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.7)", immediateRender: false },
        1.5
      );

      // clic en Abrir
      tl.add(() => moverCursor(cur, abrir, vis), 2.0);
      tl.to(abrir, { scale: 0.9, duration: 0.09, yoyo: true, repeat: 1 }, 2.95);
      tl.to(win, { opacity: 0, scale: 0.95, duration: 0.25, ease: "power2.in" }, 3.2);

      // check verde + tag de resultado
      tl.fromTo(
        check,
        { opacity: 0, scale: 0.3 },
        { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2.2)", immediateRender: false },
        3.45
      );
      tl.fromTo(
        tag,
        { opacity: 0, y: 5 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power3.out", immediateRender: false },
        3.6
      );
      tl.to([check, tag, cur], { opacity: 0, duration: 0.35, ease: "power1.in" }, 5.9);
    },
    (el) => el.querySelector(".vis-excel")?.classList.add("fin"),
    0.5
  );

  return (
    <div className="cel reveal" ref={ref} style={{ transitionDelay: ".12s" }}>
      <div className="vis vis-excel" aria-hidden="true">
        <span className="xbtn">Importar</span>

        {/* selector de archivos estilo macOS */}
        <div className="xwin-pos">
          <div className="xwin">
            <div className="xbar">
              <i></i>
              <i></i>
              <i></i>
              <span>Abrir archivo</span>
            </div>
            <div className="xcuerpo">
              <div className="xside">
                <i></i>
                <i></i>
                <i style={{ width: "70%" }}></i>
              </div>
              <div className="xlista">
                <span className="xitem">presupuesto-v3.xlsx</span>
                <span className="xitem xsel">plantilla-seiricon.xlsx</span>
                <span className="xitem">fotos-obra</span>
              </div>
            </div>
            <div className="xpie">
              <span className="xabrir">Abrir</span>
            </div>
          </div>
        </div>

        <div className="xfin">
          <span className="xcheck">
            <Check size={14} strokeWidth={3.5} />
          </span>
          <span className="excel-tag xtag">XLSX → PROYECTO</span>
        </div>
        <MiniCursor />
      </div>
      <h4>De Excel a proyecto</h4>
      <p>El presupuesto entra por Excel y sale como cronograma. Minutos, no semanas.</p>
    </div>
  );
}
