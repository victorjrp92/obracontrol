"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Eventos del feed con su retardo (ms) al entrar en vista, como el mockup. */
const EVENTOS = [
  { t: 0, color: "var(--verde)", titulo: "Evidencia aprobada", desc: "Enchape baño ppal · T1-504", meta: "hace un momento · 📍 GPS verificado" },
  { t: 900, color: "var(--azul)", titulo: "Obrero reportó", desc: "Estuco alcoba 2 · T1-302", meta: "hace 4 min · foto + ubicación" },
  { t: 1800, color: "var(--naranja)", titulo: "Anticipo sustentado", desc: "$4.2M · Ferretería El Punto", meta: "hace 12 min · factura adjunta" },
  { t: 2700, color: "var(--ambar)", titulo: "Semáforo ámbar", desc: "Pintura fachada · Torre 2", meta: "hace 20 min · plazo a 3 días" },
];

/**
 * Mapa vivo multi-obra + feed de actividad (en código, como el mockup).
 * f4 (Cali) va como ambiente muy sutil bajo la retícula del mapa. Los eventos
 * del feed aparecen escalonados al entrar en vista (GSAP); con reduced-motion
 * se muestran todos de una.
 */
export default function MapaVivo() {
  const feedRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const feed = feedRef.current;
      if (!feed) return;
      const eventos = Array.from(feed.querySelectorAll<HTMLElement>(".evento"));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduce) {
        eventos.forEach((e) => e.classList.add("on"));
        return;
      }

      const calls: gsap.core.Tween[] = [];
      ScrollTrigger.create({
        trigger: feed,
        start: "top 80%",
        once: true,
        onEnter: () => {
          eventos.forEach((e) => {
            const t = Number(e.dataset.t ?? 0) / 1000;
            calls.push(gsap.delayedCall(t, () => e.classList.add("on")));
          });
        },
      });
      return () => calls.forEach((c) => c.kill());
    },
    { scope: feedRef }
  );

  return (
    <section className="sec">
      <div className="wrap">
        <div className="sec-grid" style={{ gridTemplateColumns: "1fr", gap: 26 }}>
          <div
            className="sec-copy reveal"
            style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}
          >
            <span className="eyebrow">Multi-obra, en vivo</span>
            <h2>Todas tus obras respirando en un mapa</h2>
            <p className="txt" style={{ margin: "0 auto" }}>
              Cada pin es una obra con su avance. A la derecha, lo que va pasando — como sucede en la
              plataforma.
            </p>
          </div>
          <div className="mapa-demo reveal">
            <div className="mapa-zona">
              {/* ambiente Cali (f4), muy sutil */}
              <div className="mapa-amb" aria-hidden="true">
                <Image
                  src="/landing/fotos/f4-cali-panoramica.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 860px) 100vw, 60vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <span className="via-d" style={{ left: 0, top: 110, width: "100%", height: 11 }}></span>
              <span className="via-d" style={{ left: 180, top: 0, width: 11, height: "100%" }}></span>
              <span className="via-d" style={{ left: 0, top: 225, width: "65%", height: 8 }}></span>
              <span className="pin-d" style={{ left: "16%", top: "26%", background: "var(--verde)", color: "var(--verde)" }}></span>
              <span className="pin-tag" style={{ left: "16%", top: "26%" }}>
                Torre Alameda · 71%
              </span>
              <span className="pin-d" style={{ left: "54%", top: "58%", background: "var(--azul)", color: "var(--azul)" }}></span>
              <span className="pin-tag" style={{ left: "54%", top: "58%" }}>
                Conjunto Roble · 46%
              </span>
              <span className="pin-d" style={{ left: "78%", top: "30%", background: "var(--ambar)", color: "var(--ambar)" }}></span>
              <span className="pin-tag" style={{ left: "78%", top: "30%" }}>
                Casa Pance · plazo cerca
              </span>
            </div>
            <div className="feed" ref={feedRef}>
              <h4>
                <span className="led"></span> Actividad de tus obras — ahora
              </h4>
              {EVENTOS.map((ev, i) => (
                <div className="evento" data-t={ev.t} key={i}>
                  <span className="pt" style={{ background: ev.color }}></span>
                  <div>
                    <b>{ev.titulo}</b> — {ev.desc}
                    <small>{ev.meta}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
