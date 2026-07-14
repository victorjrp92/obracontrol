"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import CursorGo from "./CursorGo";
import { useLoopGo, moverCursor } from "./useLoopGo";

/**
 * Micro-demo del paso 1 "Le llega el link": el cursor fantasma pulsa
 * "Copiar link" → "Copiado" con check → sale la burbuja de chat con el link
 * → corte a la pantalla del maestro: sus tareas listas para iniciar. Loop
 * (patrón FeedVivo vía useLoopGo); reduced-motion = pantalla final estática.
 */
export default function PasoLinkDemo() {
  const root = useLoopGo<HTMLDivElement>(
    (el, tl) => {
      const q = (s: string) => el.querySelector(s) as HTMLElement;
      const a = q(".dl-a");
      const b = q(".dl-b");
      const btn = q(".dl-btn");
      const btnTxt = q(".dl-btn span");
      const bur = q(".dl-bur");
      const cur = q(".mcur");
      const tareas = Array.from(el.querySelectorAll<HTMLElement>(".dl-tarea"));

      // t=0 de cada vuelta: pantalla A limpia, botón sin copiar
      tl.set(a, { opacity: 1 }, 0);
      tl.set(b, { opacity: 0 }, 0);
      tl.set(bur, { opacity: 0, y: 8 }, 0);
      tl.set(tareas, { opacity: 0, y: 8 }, 0);
      tl.set(cur, { opacity: 0 }, 0);
      tl.add(() => {
        btn.classList.remove("ok");
        btnTxt.textContent = "Copiar link";
        cur.style.left = "82%";
        cur.style.top = "78%";
      }, 0);

      // clic en "Copiar link" → "Copiado"
      tl.to(cur, { opacity: 1, duration: 0.25 }, 0.3);
      tl.add(() => moverCursor(cur, btn, el), 0.4);
      tl.to(btn, { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 }, 1.25);
      tl.call(
        () => {
          btn.classList.add("ok");
          btnTxt.textContent = "Copiado";
        },
        [],
        1.45
      );

      // la burbuja de chat con el link
      tl.to(bur, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, 1.95);
      tl.to(cur, { opacity: 0, duration: 0.3 }, 2.9);

      // corte a la pantalla del que lo recibe: sus tareas
      tl.to(a, { opacity: 0, duration: 0.4 }, 3.3);
      tl.to(b, { opacity: 1, duration: 0.4 }, 3.55);
      tareas.forEach((t, i) =>
        tl.to(t, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }, 3.95 + i * 0.45)
      );
      tl.to({}, { duration: 6.8 }, 0); // duración total del ciclo
    },
    (el) => el.classList.add("fin"),
    0.6
  );

  return (
    <div className="paso-demo demo-link" ref={root} aria-hidden="true">
      <div className="dl-a">
        <span className="dl-btn">
          <LinkIcon className="ic dl-ic-lk" strokeWidth={2.4} aria-hidden="true" />
          <Check className="ic dl-ic-ok" strokeWidth={3} aria-hidden="true" />
          <span>Copiar link</span>
        </span>
        <span className="dl-bur mono">seiricon.com/o/x7k2…</span>
      </div>
      <div className="dl-b">
        <span className="dl-rotulo">Tareas listas para iniciar</span>
        <span className="dl-tarea">
          <i></i>Enchape baño social
        </span>
        <span className="dl-tarea">
          <i></i>Pañete de fachada
        </span>
      </div>
      <CursorGo />
    </div>
  );
}
