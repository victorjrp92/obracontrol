"use client";

import { MapPin } from "lucide-react";
import MiniCursor from "./MiniCursor";
import { useLoopDemo, moverCursor } from "./useLoopDemo";

/**
 * Micro-demo de evidencia GPS: el mini-cursor hace clic en el chip de
 * coordenadas y se despliega un mini-mapa (retícula + pin pulsando). Loop.
 * Las coordenadas son las de Cali que se ven en las capturas reales.
 */
export default function CelGps() {
  const ref = useLoopDemo<HTMLDivElement>(
    (el, tl) => {
      const vis = el.querySelector<HTMLElement>(".vis-gps")!;
      const chip = el.querySelector<HTMLElement>(".gps-chip")!;
      const mapa = el.querySelector<HTMLElement>(".gps-mapa")!;
      const cur = el.querySelector<HTMLElement>(".mcur")!;

      tl.set(mapa, { height: 0, opacity: 0 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        cur.style.left = "80%";
        cur.style.top = "80%";
      }, 0);

      // clic en las coordenadas…
      tl.to(cur, { opacity: 1, duration: 0.25 }, 0.25);
      tl.add(() => moverCursor(cur, chip, vis), 0.35);
      tl.to(chip, { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 }, 1.25);

      // …y se despliega el mini-mapa del punto de la foto
      tl.to(mapa, { height: 56, opacity: 1, duration: 0.45, ease: "power3.inOut" }, 1.45);
      tl.to(cur, { opacity: 0, duration: 0.3 }, 2.2);
      tl.to(mapa, { height: 0, opacity: 0, duration: 0.4, ease: "power2.in" }, 4.6);
    },
    (el) => el.querySelector(".vis-gps")?.classList.add("fin"),
    0.6
  );

  return (
    <div className="cel reveal" ref={ref} style={{ transitionDelay: ".06s" }}>
      <div className="vis vis-gps" aria-hidden="true">
        <span className="gps-chip">
          <MapPin size={11} aria-hidden="true" />
          3.43725, -76.52295 · 10:42
        </span>
        <div className="gps-mapa">
          <span className="gps-pin"></span>
        </div>
        <MiniCursor />
      </div>
      <h4>Evidencia con GPS y hora</h4>
      <p>Cada foto prueba dónde y cuándo. El historial queda para siempre.</p>
    </div>
  );
}
