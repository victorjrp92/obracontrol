"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Demo viva del hero, EN CÓDIGO (nunca video): un obrero reporta un avance →
 * llega la foto con GPS → el cursor aprueba → toast + la plata pasa a verde.
 * Portada 1:1 de la `secuencia()` del mockup, ahora como timeline de GSAP con
 * loop. Con prefers-reduced-motion se pinta el estado final estático.
 */
export default function LiveDemo() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const get = (sel: string) => el.querySelector(sel) as HTMLElement;

      const th = get('[data-d="th"]');
      const meta = get('[data-d="meta"]');
      const pill = get('[data-d="pill"]');
      const btn = get('[data-d="btn"]');
      const cur = get('[data-d="cursor"]');
      const toast = get('[data-d="toast"]');
      const st = get('[data-d="status"]');
      const stTxt = get('[data-d="statusTxt"]');
      const alarma = get('[data-d="alarma"]');
      const kA = get('[data-d="kA"]');
      const kB = get('[data-d="kB"]');
      const kS = get('[data-d="kS"]');
      const fila = get('[data-d="fila"]');
      const frame = get('[data-d="frame"]');

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        th.classList.add("on");
        pill.textContent = "Aprobada";
        pill.classList.add("ok");
        meta.textContent = "📍 GPS · hoy 10:42 a.m.";
        st.classList.add("ok");
        stTxt.textContent = "✓ Aprobada — historial guardado";
        return;
      }

      const reset = () => {
        th.classList.remove("on");
        pill.textContent = "Pendiente";
        pill.classList.remove("ok");
        meta.textContent = "esperando reporte…";
        toast.classList.remove("on");
        st.classList.remove("ok");
        stTxt.textContent = "Obrero reportando…";
        alarma.classList.remove("ok");
        alarma.innerHTML = "⚠ $42 M sin sustentar — 3 anticipos";
        kA.textContent = "63%";
        kB.style.width = "63%";
        kS.textContent = "$268 M";
        fila.classList.remove("foco");
        cur.style.left = "76%";
        cur.style.top = "82%";
      };

      reset();

      const tl = gsap.timeline({ repeat: -1, onRepeat: reset });

      tl.add(() => {
        th.classList.add("on");
        meta.textContent = "📍 GPS verificado · hoy 10:42 a.m.";
        stTxt.textContent = "Foto recibida — GPS verificado";
        fila.classList.add("foco");
      }, 1.1);
      tl.add(() => {
        pill.textContent = "Reportada";
      }, 1.5);
      tl.add(() => {
        const r = btn.getBoundingClientRect();
        const d = frame.getBoundingClientRect();
        cur.style.left = ((r.left + r.width / 2 - d.left) / d.width) * 100 + "%";
        cur.style.top = ((r.top + r.height / 2 - d.top) / d.height) * 100 + "%";
      }, 2.3);
      tl.add(() => {
        btn.classList.add("click");
        gsap.delayedCall(0.6, () => btn.classList.remove("click"));
      }, 3.4);
      tl.add(() => {
        pill.textContent = "Aprobada";
        pill.classList.add("ok");
        toast.classList.add("on");
        st.classList.add("ok");
        stTxt.textContent = "✓ Aprobada — historial guardado";
        kA.textContent = "64%";
        kB.style.width = "64%";
      }, 3.7);
      tl.add(() => {
        kS.textContent = "$281 M";
        alarma.classList.add("ok");
        alarma.innerHTML = "✓ Anticipo sustentado — quedan $29 M por revisar";
      }, 4.6);
      tl.add(() => {
        toast.classList.remove("on");
        fila.classList.remove("foco");
      }, 6.3);
      // cola hasta ~7.6s para que respire antes de repetir
      tl.to({}, { duration: 1.3 });
    },
    { scope: root }
  );

  return (
    <div className="demo" ref={root}>
      <div className="demo-frame" data-d="frame">
        <div className="demo-top">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="demo-url">app.seiricon.com — Torre 1</span>
          <span className="status" data-d="status">
            <span className="led"></span>
            <span data-d="statusTxt">Obrero reportando…</span>
          </span>
        </div>
        <div className="demo-body">
          <div className="panel-izq">
            <div className="ph4">Tareas de hoy · Torre 1</div>
            <div className="trow" data-d="fila">
              <span className="th" data-d="th"></span>
              <div>
                <b>Estuco alcoba 2 — Apto 302</b>
                <small data-d="meta">esperando reporte…</small>
              </div>
              <span className="estado-pill" data-d="pill">
                Pendiente
              </span>
              <span className="btn-aprobar" data-d="btn" aria-hidden="true">
                Aprobar
                <span className="anillo"></span>
              </span>
            </div>
            <div className="trow">
              <span className="th on" style={{ animation: "none", opacity: 1, transform: "none" }}></span>
              <div>
                <b>Enchape baño ppal — Apto 504</b>
                <small>📍 GPS · hoy 9:12 a.m.</small>
              </div>
              <span className="estado-pill ok">Aprobada</span>
            </div>
            <div className="trow">
              <span className="th on" style={{ animation: "none", opacity: 1, transform: "none" }}></span>
              <div>
                <b>Pintura fachada norte — T2</b>
                <small>📍 GPS · hoy 8:03 a.m.</small>
              </div>
              <span className="estado-pill ok">Aprobada</span>
            </div>
          </div>
          <div className="panel-der">
            <div className="ph4">La obra, ahora</div>
            <div className="krow">
              <span>Avance aprobado</span>
              <b data-d="kA">63%</b>
            </div>
            <div className="kbar">
              <i data-d="kB"></i>
            </div>
            <div className="krow">
              <span>Entregado a contratistas</span>
              <b>$310 M</b>
            </div>
            <div className="krow">
              <span>Sustentado con factura</span>
              <b style={{ color: "var(--verde)" }} data-d="kS">
                $268 M
              </b>
            </div>
            <div className="alarma-d" data-d="alarma">
              ⚠ $42 M sin sustentar — 3 anticipos
            </div>
          </div>
        </div>
        <div className="toast" data-d="toast">
          ✓ Evidencia aprobada — Estuco alcoba 2
        </div>
        <div className="cursor" data-d="cursor" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M2 1 L2 14 L6 11 L8.5 16.5 L11 15.3 L8.6 10 L13.5 9.6 Z"
              fill="#0F172A"
              stroke="#fff"
              strokeWidth="1.3"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
