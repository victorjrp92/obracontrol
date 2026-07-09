"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Hook común de las micro-demos del grid denso: construye un timeline GSAP en
 * loop, lo pausa fuera de viewport (IntersectionObserver) y, con
 * prefers-reduced-motion, no anima nada: aplica el estado final estático.
 */
export function useLoopDemo<T extends HTMLElement>(
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
        { threshold: 0.35 }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    { scope: ref }
  );

  return ref;
}

/**
 * Mueve el mini-cursor de una micro-demo al centro de un elemento objetivo.
 * El desplazamiento lo hace la transición CSS de `.mcur` (left/top).
 */
export function moverCursor(cursor: HTMLElement, objetivo: HTMLElement, zona: HTMLElement) {
  const r = objetivo.getBoundingClientRect();
  const z = zona.getBoundingClientRect();
  cursor.style.left = ((r.left + r.width / 2 - z.left) / z.width) * 100 + "%";
  cursor.style.top = ((r.top + r.height / 2 - z.top) / z.height) * 100 + "%";
}
