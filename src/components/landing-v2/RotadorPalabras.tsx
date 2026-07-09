"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

/** Sustantivos que rotan en el h1: "Tu {…} bajo control". Empieza y descansa en "obra". */
const PALABRAS = ["obra", "equipo", "proyecto", "calidad", "progreso", "contratista"];

/** Segundos que cada palabra permanece visible. */
const PAUSA = 2.5;

/**
 * Palabra rotatoria del titular del hero. El ancho del slot lo fija la palabra
 * más larga ("contratista") con un medidor invisible, para que el layout no
 * salte. Las palabras se apilan en absoluto y GSAP las alterna con fade/slide.
 * Con prefers-reduced-motion (o sin JS) queda "obra" fija.
 */
export default function RotadorPalabras() {
  const root = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const pals = Array.from(el.querySelectorAll<HTMLElement>(".pal"));
      const n = pals.length;

      const tl = gsap.timeline({ repeat: -1 });
      pals.forEach((pal, i) => {
        const sig = pals[(i + 1) % n];
        // sale la actual…
        tl.to(pal, { yPercent: -55, opacity: 0, duration: 0.38, ease: "power2.in" }, i * PAUSA + PAUSA - 0.38);
        // …y entra la siguiente, con un pelito de solape
        tl.fromTo(
          sig,
          { yPercent: 55, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
          i * PAUSA + PAUSA - 0.1
        );
      });
    },
    { scope: root }
  );

  return (
    <span className="rotor" ref={root}>
      {/* la palabra real para lectores de pantalla / sin JS */}
      <span className="vh">obra</span>
      {/* medidor invisible: fija el ancho del slot a la palabra más larga */}
      <span className="medida" aria-hidden="true">
        {PALABRAS.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      <span className="pals" aria-hidden="true">
        {PALABRAS.map((p, i) => (
          <span key={p} className={`pal${i === 0 ? " on" : ""}`}>
            {p}
          </span>
        ))}
      </span>
    </span>
  );
}
