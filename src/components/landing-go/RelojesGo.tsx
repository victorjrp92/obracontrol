"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/**
 * Ciudades que rotan en el chip de relojes (pedido de Victor): la ciudad
 * extranjera va cambiando; Cali 16:04 queda fija.
 */
const CIUDADES = ["Madrid 22:04", "Nueva York 17:04", "Toronto 17:04"];

/**
 * Chip de relojes del hero y del cierre: la ciudad extranjera rota
 * Madrid → Nueva York → Toronto con un fade vertical; Cali queda fija.
 * `inicial` decide con qué ciudad arranca cada instancia (hero: Madrid,
 * cierre: Nueva York, como el mockup). La rotación se pausa fuera de vista
 * (IntersectionObserver) y con prefers-reduced-motion queda quieta en la
 * ciudad inicial.
 */
export default function RelojesGo({ inicial = 0 }: { inicial?: number }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const ciudad = el.querySelector('[data-r="ciudad"]') as HTMLElement;
      let i = inicial;

      const tl = gsap.timeline({ repeat: -1 });
      tl.to({}, { duration: 2.8 }); // ciudad visible
      tl.to(ciudad, { opacity: 0, y: -6, duration: 0.3, ease: "power1.in" });
      tl.add(() => {
        i = (i + 1) % CIUDADES.length;
        ciudad.textContent = CIUDADES[i];
        gsap.set(ciudad, { y: 6 });
      });
      tl.to(ciudad, { opacity: 1, y: 0, duration: 0.3, ease: "power1.out" });

      // Pausa fuera de viewport (ahorra CPU y batería)
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) tl.play();
          else tl.pause();
        },
        { threshold: 0.2 }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    { scope: root }
  );

  return (
    <div className="relojes" ref={root}>
      <span className="reloj-ext">
        <span data-r="ciudad">{CIUDADES[inicial]}</span>
      </span>
      <span className="pto"></span>
      <span className="reloj-cali">Cali 16:04</span>
    </div>
  );
}
