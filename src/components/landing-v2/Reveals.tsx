"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Gestiona los reveals de scroll de toda la landing v2 con GSAP ScrollTrigger.
 * Recorre los elementos `.reveal` / `.reveal-shot` dentro de `.lv2` y les añade
 * la clase `vista` al entrar en pantalla (las transiciones CSS hacen el resto).
 * Con prefers-reduced-motion se muestran todos de una, sin animación.
 */
export default function Reveals() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".lv2 .reveal, .lv2 .reveal-shot")
    );
    if (els.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      els.forEach((el) => el.classList.add("vista"));
      return;
    }

    const triggers = els.map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        once: true,
        onEnter: () => el.classList.add("vista"),
      })
    );

    ScrollTrigger.refresh();
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return null;
}
