"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/** Sustantivos que rotan en el h1: "Tu {…} bajo control". Empieza en "obra". */
const PALABRAS = ["obra", "equipo", "proyecto", "calidad", "progreso", "contratista"];

/** Segundos que cada palabra permanece visible. */
const PAUSA = 2.5;

/**
 * Palabra rotatoria del titular, construida como en el landing original: un
 * solo slot inline que abraza a la palabra visible. En cada cambio, el ancho
 * del slot se anima hacia el de la palabra que entra (medida con un medidor
 * invisible) y, como el h1 está centrado, el "Tu" se recoloca solo. Entre
 * cambios el ancho vuelve a `auto` para no perder el responsive. Con
 * prefers-reduced-motion (o sin JS) queda "obra" fija.
 */
export default function RotadorPalabras() {
  const root = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const pal = el.querySelector(".pal") as HTMLElement;
      const medida = el.querySelector(".medida") as HTMLElement;
      let i = 0;
      let anim: gsap.core.Timeline | null = null;
      let espera: gsap.core.Tween | null = null;

      const siguiente = () => {
        const anchoActual = el.offsetWidth;
        i = (i + 1) % PALABRAS.length;
        medida.textContent = PALABRAS[i];
        const anchoNuevo = medida.offsetWidth;

        anim = gsap.timeline({
          onComplete: () => {
            gsap.set(el, { width: "auto" }); // entre cambios, ancho intrínseco (responsive)
            espera = gsap.delayedCall(PAUSA, siguiente);
          },
        });
        anim.set(el, { width: anchoActual }, 0);
        anim.to(pal, { yPercent: -55, opacity: 0, duration: 0.3, ease: "power2.in" }, 0);
        anim.to(el, { width: anchoNuevo, duration: 0.4, ease: "power2.inOut" }, 0.08);
        anim.add(() => {
          pal.textContent = PALABRAS[i];
          gsap.set(pal, { yPercent: 55 });
        }, 0.3);
        anim.to(pal, { yPercent: 0, opacity: 1, duration: 0.4, ease: "power3.out" }, 0.36);
      };

      espera = gsap.delayedCall(PAUSA, siguiente);
      return () => {
        espera?.kill();
        anim?.kill();
      };
    },
    { scope: root }
  );

  return (
    <span className="rotor" ref={root}>
      {/* la palabra real para lectores de pantalla / sin JS */}
      <span className="vh">obra</span>
      {/* medidor invisible: da el ancho destino de la palabra que entra */}
      <span className="medida" aria-hidden="true">
        obra
      </span>
      <span className="pal" aria-hidden="true">
        obra
      </span>
    </span>
  );
}
