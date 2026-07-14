"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import CursorGo from "./CursorGo";
import { useLoopGo, moverCursor, tipear } from "./useLoopGo";

const COMENTARIO = "Quedó nivelado. Revisar boquilla mañana.";

/**
 * Micro-demo del paso 2 "Toma la foto del avance": marco de cámara → la foto
 * aparece con un flash suave → el comentario se tipea carácter a carácter →
 * el cursor fantasma pulsa "Enviar avance". Loop (patrón FeedVivo vía
 * useLoopGo); reduced-motion = foto y comentario completos, estáticos.
 */
export default function PasoFotoDemo() {
  const root = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as HTMLElement;
      const foto = q(".df-foto");
      const flash = q(".df-flash");
      const coment = q('[data-d="coment"]');
      const btn = q(".df-btn");
      const cur = q(".mcur");

      // t=0 de cada vuelta: marco vacío, comentario en blanco
      tl.set(foto, { opacity: 0 }, 0);
      tl.set(flash, { opacity: 0 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        coment.textContent = "";
        cur.style.left = "80%";
        cur.style.top = "20%";
      }, 0);

      // flash suave y aparece la foto
      tl.to(flash, { opacity: 0.9, duration: 0.12 }, 0.6);
      tl.to(flash, { opacity: 0, duration: 0.4 }, 0.75);
      tl.to(foto, { opacity: 1, duration: 0.3 }, 0.65);

      // se tipea el comentario y se envía
      tipear(tl, coment, COMENTARIO, 1.4, 0.045);
      tl.to(cur, { opacity: 1, duration: 0.25 }, 3.5);
      tl.add(() => moverCursor(cur, btn, el), 3.6);
      tl.to(btn, { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 }, 4.5);
      tl.to(cur, { opacity: 0, duration: 0.3 }, 4.8);
      tl.to({}, { duration: 6.4 }, 0); // duración total del ciclo
    },
    (el) => {
      el.classList.add("fin");
      const coment = el.querySelector('[data-d="coment"]') as HTMLElement;
      coment.textContent = COMENTARIO;
    },
    0.6
  );

  return (
    <div className="paso-demo demo-foto" ref={root} aria-hidden="true">
      <div className="df-marco">
        <span className="df-cam">
          <Camera className="ic" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="df-foto">
          <Image src="/landing/fotos/f2-manos-panete.jpg" alt="" fill sizes="330px" />
        </span>
        <span className="df-flash"></span>
      </div>
      <div className="df-coment">
        <span data-d="coment"></span>
        <i className="df-caret"></i>
      </div>
      <span className="df-btn">Enviar avance</span>
      <CursorGo />
    </div>
  );
}
