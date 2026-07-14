"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Patrón FeedVivo generalizado para las micro-demos en loop de la landing Go
 * (mismo enfoque que useLoopDemo del grid B2B): construye un timeline GSAP
 * `repeat:-1` (los resets van como sets/calls en el tiempo 0, que se
 * re-ejecutan en cada vuelta), lo pausa fuera de viewport con
 * IntersectionObserver y, con prefers-reduced-motion, no anima nada:
 * `estatico(el)` pinta el estado final coherente. useGSAP cubre el cleanup
 * del timeline al desmontar; el IO se desconecta en el return.
 */
export function useLoopGo<T extends HTMLElement>(
  build: (el: T, tl: gsap.core.Timeline) => void,
  estatico: (el: T) => void,
  repeatDelay = 0.5
) {
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        estatico(el);
        return;
      }

      const tl = gsap.timeline({ repeat: -1, repeatDelay, paused: true });
      build(el, tl);

      const io = new IntersectionObserver(
        ([e]) => (e.isIntersecting ? tl.play() : tl.pause()),
        { threshold: 0.3 }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    { scope: ref }
  );

  return ref;
}

/**
 * Mueve el cursor fantasma al centro de un elemento objetivo. El
 * desplazamiento lo hace la transición CSS de `.mcur` (left/top).
 */
export function moverCursor(cursor: HTMLElement, objetivo: HTMLElement, zona: HTMLElement) {
  const r = objetivo.getBoundingClientRect();
  const z = zona.getBoundingClientRect();
  cursor.style.left = ((r.left + r.width / 2 - z.left) / z.width) * 100 + "%";
  cursor.style.top = ((r.top + r.height / 2 - z.top) / z.height) * 100 + "%";
}

/**
 * Tipea `texto` carácter a carácter dentro de `el` a partir del segundo `en`
 * del timeline. En cada vuelta del loop vuelve a tipear desde cero (el reset
 * del texto va en el tiempo 0 del timeline de cada demo).
 */
export function tipear(
  tl: gsap.core.Timeline,
  el: HTMLElement,
  texto: string,
  en: number,
  porChar = 0.05
) {
  const p = { n: 0 };
  tl.to(
    p,
    {
      n: texto.length,
      duration: texto.length * porChar,
      ease: "none",
      onUpdate: () => {
        el.textContent = texto.slice(0, Math.round(p.n));
      },
    },
    en
  );
}
