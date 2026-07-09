"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Eventos del feed con su retardo (ms) al entrar en vista, como el mockup. */
const EVENTOS = [
  { t: 0, color: "var(--verde)", titulo: "Evidencia aprobada", desc: "Enchape baño ppal · T1-504", meta: "hace un momento · GPS verificado" },
  { t: 900, color: "var(--azul)", titulo: "Obrero reportó", desc: "Estuco alcoba 2 · T1-302", meta: "hace 4 min · foto + ubicación" },
  { t: 1800, color: "var(--naranja)", titulo: "Anticipo sustentado", desc: "$4.2M · Ferretería El Punto", meta: "hace 12 min · factura adjunta" },
  { t: 2700, color: "var(--ambar)", titulo: "Semáforo en alerta", desc: "Pintura fachada · Torre 2", meta: "hace 20 min · plazo a 3 días" },
];

/** Las 3 obras del mapa: posición (%), color de pin y datos del panel de detalle. */
const OBRAS = [
  {
    x: 16, y: 26, color: "var(--verde)", tag: "Torre Alameda · 71%",
    nombre: "Torre Alameda", avance: "71%", repApr: "18 / 14", sem: "a tiempo", semColor: "var(--verde)",
    wRep: 92, wApr: 72,
  },
  {
    x: 54, y: 58, color: "var(--azul)", tag: "Conjunto Roble · 46%",
    nombre: "Conjunto Roble", avance: "46%", repApr: "12 / 9", sem: "a tiempo", semColor: "var(--verde)",
    wRep: 64, wApr: 48,
  },
  {
    x: 78, y: 30, color: "var(--ambar)", tag: "Casa Pance · en alerta",
    nombre: "Casa Pance", avance: "58%", repApr: "9 / 6", sem: "alerta", semColor: "var(--ambar)",
    wRep: 74, wApr: 50,
  },
];

/** Escala de la "cámara" cuando se acerca a un pin. */
const ZOOM = 1.65;

/**
 * Mapa vivo multi-obra + feed de actividad, TODO en código (v2.1: sin foto de
 * ambiente). La cámara (transform del mundo) viaja de pin en pin: se acerca,
 * abre el panel de detalle de la obra (avance, reportadas vs. aprobadas con
 * doble barra, semáforo), lo cierra y sigue. Loop, pausado fuera de vista.
 * Con reduced-motion: mapa quieto con el panel de la primera obra abierto.
 */
export default function MapaVivo() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // ── feed de actividad: eventos escalonados al entrar en vista ──
      const eventos = Array.from(el.querySelectorAll<HTMLElement>(".evento"));
      const calls: gsap.core.Tween[] = [];
      if (reduce) {
        eventos.forEach((e) => e.classList.add("on"));
      } else {
        ScrollTrigger.create({
          trigger: el.querySelector(".feed"),
          start: "top 80%",
          once: true,
          onEnter: () => {
            eventos.forEach((e) => {
              const t = Number(e.dataset.t ?? 0) / 1000;
              calls.push(gsap.delayedCall(t, () => e.classList.add("on")));
            });
          },
        });
      }

      // ── cámara del mapa ──
      const cam = el.querySelector<HTMLElement>(".mapa-cam");
      const panel = el.querySelector<HTMLElement>(".pin-panel");
      if (!cam || !panel) return;

      const setPanel = (i: number) => {
        const o = OBRAS[i];
        const q = (sel: string) => panel.querySelector(sel) as HTMLElement;
        q(".pp-nombre").textContent = o.nombre;
        q(".pp-avance").textContent = o.avance;
        q(".pp-repapr").textContent = o.repApr;
        q(".pp-sem").textContent = o.sem;
        q(".pp-sem").style.color = o.semColor;
        q(".pp-led").style.background = o.semColor;
        q(".pp-rep").style.width = o.wRep + "%";
        q(".pp-apr").style.width = o.wApr + "%";
      };

      if (reduce) {
        setPanel(0);
        panel.classList.add("on");
        return;
      }

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8, paused: true });
      // vista general de arranque. El zoom anima el LAYOUT del mundo (width/left),
      // no transform: escalar rasteriza la capa y el texto pierde nitidez al
      // acercarse; así todo se re-renderiza nítido y los pines/etiquetas
      // conservan su tamaño, como en un mapa real.
      tl.set(cam, { width: "100%", height: "100%", left: "0%", top: "0%" });
      tl.to({}, { duration: 1.2 });

      OBRAS.forEach((o, i) => {
        // la cámara viaja al pin (centrándolo) mientras hace zoom
        tl.to(cam, {
          width: ZOOM * 100 + "%",
          height: ZOOM * 100 + "%",
          left: 50 - o.x * ZOOM + "%",
          top: 50 - o.y * ZOOM + "%",
          duration: 1.35,
          ease: "power2.inOut",
        });
        // abre el panel de detalle de esa obra
        tl.add(() => setPanel(i));
        tl.fromTo(
          panel,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false,
            onStart: () => panel.classList.add("on") }
        );
        tl.to({}, { duration: 2.3 }); // se deja leer
        tl.to(panel, {
          opacity: 0, y: 8, duration: 0.28, ease: "power2.in",
          onComplete: () => panel.classList.remove("on"),
        });
      });

      // vuelve a la vista general antes de repetir
      tl.to(cam, {
        width: "100%",
        height: "100%",
        left: "0%",
        top: "0%",
        duration: 1.2,
        ease: "power2.inOut",
      });

      // corre solo cuando el mapa está en pantalla
      const io = new IntersectionObserver(
        ([e]) => (e.isIntersecting ? tl.play() : tl.pause()),
        { threshold: 0.25 }
      );
      io.observe(el.querySelector(".mapa-zona") as Element);

      return () => {
        io.disconnect();
        calls.forEach((c) => c.kill());
      };
    },
    { scope: root }
  );

  return (
    <section className="sec" ref={root}>
      <div className="wrap">
        <div className="sec-grid" style={{ gridTemplateColumns: "1fr", gap: 26 }}>
          <div
            className="sec-copy reveal"
            style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}
          >
            <span className="eyebrow">Multi-obra, en vivo</span>
            <h2>Todas tus obras respirando en un mapa</h2>
            <p className="txt" style={{ margin: "0 auto" }}>
              Cada pin es un proyecto con su semáforo y su avance. Tocas uno y ves lo reportado
              contra lo aprobado — sin llamar a nadie.
            </p>
          </div>
          <div className="mapa-demo reveal">
            <div className="mapa-zona">
              {/* el "mundo" que mueve la cámara: retícula de calles + pines.
                  Posiciones en % para que acompañen el zoom por layout. */}
              <div className="mapa-cam" aria-hidden="true">
                {/* las calles se pasan de los bordes: la cámara nunca muestra su final */}
                <span className="via-d" style={{ left: "-40%", top: "32%", width: "180%", height: 11 }}></span>
                <span className="via-d" style={{ left: "27%", top: "-40%", width: 11, height: "180%" }}></span>
                <span className="via-d" style={{ left: "-40%", top: "66%", width: "105%", height: 8 }}></span>
                <span className="via-d" style={{ left: "72%", top: "-40%", width: 8, height: "115%" }}></span>
                {OBRAS.map((o) => (
                  <span key={o.nombre}>
                    <span
                      className="pin-d"
                      style={{ left: `${o.x}%`, top: `${o.y}%`, background: o.color, color: o.color }}
                    ></span>
                    <span className="pin-tag" style={{ left: `${o.x}%`, top: `${o.y}%` }}>
                      {o.tag}
                    </span>
                  </span>
                ))}
              </div>

              {/* panel de detalle del pin (fuera de la cámara: no se escala) */}
              <div className="pin-panel" aria-hidden="true">
                <b className="pp-nombre">Torre Alameda</b>
                <div className="pp-fila">
                  <span>Avance aprobado</span>
                  <b className="pp-avance">71%</b>
                </div>
                <div className="pp-fila">
                  <span>Reportadas vs. aprobadas</span>
                  <b className="pp-repapr">18 / 14</b>
                </div>
                <div className="kbar dual pp-barra">
                  <i className="rep pp-rep" style={{ width: "92%" }}></i>
                  <i className="apr pp-apr" style={{ width: "72%" }}></i>
                </div>
                <div className="pp-fila">
                  <span>Semáforo</span>
                  <b className="pp-semwrap">
                    <i className="pp-led"></i>
                    <span className="pp-sem" style={{ color: "var(--verde)" }}>a tiempo</span>
                  </b>
                </div>
              </div>
            </div>
            <div className="feed">
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
