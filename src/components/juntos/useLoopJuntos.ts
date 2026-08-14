"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Loop de micro-demo para «Juntos» — copia adaptada de
 * src/components/landing-go/useLoopGo.ts (patrón FeedVivo, pedido explícito
 * del spec: "patrón useLoopGo — cópialo/adáptalo"): timeline GSAP `repeat:-1`
 * (los resets van como sets/calls en el tiempo 0), pausado fuera de viewport
 * con IntersectionObserver y, con prefers-reduced-motion, no anima nada:
 * `estatico(el)` pinta el estado final coherente. useGSAP cubre el cleanup
 * del timeline al desmontar; el IO se desconecta en el return.
 */
export function useLoopJuntos<T extends HTMLElement>(
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
