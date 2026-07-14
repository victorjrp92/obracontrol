"use client";

import { Clock, MapPin } from "lucide-react";
import CursorGo from "./CursorGo";
import { useLoopGo, moverCursor } from "./useLoopGo";

/**
 * Micro-demo del paso 3 "Entra al sistema": la tarjeta del avance entra, se
 * estampan los chips de GPS (coordenada real), fecha y hora → el cursor
 * fantasma hace clic en la coordenada → se abre el minimapa (retícula de
 * calles + pin con onda, como CelGps del B2B) centrado en el punto. Loop
 * (patrón FeedVivo vía useLoopGo); reduced-motion = tarjeta con chips y
 * minimapa abiertos, estáticos.
 */
export default function PasoSistemaDemo() {
  const root = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as HTMLElement;
      const card = q(".ds-card");
      const gps = q(".ds-gps");
      const hora = q(".ds-hora");
      const mapa = q(".ds-mapa");
      const cur = q(".mcur");

      // t=0 de cada vuelta: sin tarjeta, sin chips, mapa cerrado
      tl.set(card, { opacity: 0, y: -10 }, 0);
      tl.set([gps, hora], { opacity: 0, scale: 0.7 }, 0);
      tl.set(mapa, { height: 0, opacity: 0 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        cur.style.left = "84%";
        cur.style.top = "80%";
      }, 0);

      // la tarjeta entra al sistema y los chips se estampan
      tl.to(card, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.3);
      tl.to(gps, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, 0.95);
      tl.to(hora, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, 1.3);

      // clic en la coordenada → se abre el minimapa
      tl.to(cur, { opacity: 1, duration: 0.25 }, 1.9);
      tl.add(() => moverCursor(cur, gps, el), 2.0);
      tl.to(gps, { scale: 0.92, duration: 0.09, yoyo: true, repeat: 1 }, 2.95);
      tl.to(mapa, { height: 46, opacity: 1, duration: 0.45, ease: "power3.inOut" }, 3.15);
      tl.to(cur, { opacity: 0, duration: 0.3 }, 3.7);

      // pausa con el mapa abierto → cierre suave y reinicia
      tl.to(mapa, { height: 0, opacity: 0, duration: 0.4, ease: "power2.in" }, 6.1);
      tl.to(card, { opacity: 0, duration: 0.35 }, 6.2);
      tl.to({}, { duration: 6.6 }, 0); // duración total del ciclo
    },
    (el) => el.classList.add("fin"),
    0.6
  );

  return (
    <div className="paso-demo demo-sis" ref={root} aria-hidden="true">
      <div className="ds-card">
        <b>Enchape baño social</b>
        <div className="ds-chips">
          <span className="ds-chip ds-gps mono">
            <MapPin className="ic" strokeWidth={2.4} aria-hidden="true" />
            3.4372, -76.5229
          </span>
          <span className="ds-chip ds-hora">
            <Clock className="ic" strokeWidth={2.4} aria-hidden="true" />
            Hoy · 4:02 p. m.
          </span>
        </div>
      </div>
      <div className="ds-mapa">
        <span className="ds-pin"></span>
      </div>
      <CursorGo />
    </div>
  );
}
