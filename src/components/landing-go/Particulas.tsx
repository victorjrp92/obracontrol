"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo de partículas en canvas (referencia aprobada por Victor), adaptado a
 * los estándares del repo: sin re-render por movimiento de mouse (todo va por
 * refs), requestAnimationFrame cancelado al desmontar, pausa fuera de vista
 * con IntersectionObserver y, con prefers-reduced-motion, un campo ESTÁTICO
 * pintado una sola vez (sin animación ni magnetismo).
 *
 * Deriva lenta + magnetismo sutil hacia el cursor + desvanecido en bordes.
 */

type Particula = {
  x: number;
  y: number;
  trasX: number;
  trasY: number;
  radio: number;
  alfa: number;
  alfaMeta: number;
  dx: number;
  dy: number;
  magnetismo: number;
};

interface ParticulasProps {
  className?: string;
  /** Cuántas partículas pinta (según el tamaño del área, 50-100 va bien). */
  cantidad?: number;
  /** Color en hex (#fff sobre fondos oscuros). */
  color?: string;
  /** Radio base en px; cada partícula suma hasta 2px aleatorios. */
  tamano?: number;
}

function hexARgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ESTATICIDAD = 50;
const SUAVIDAD = 50;

export default function Particulas({
  className = "",
  cantidad = 80,
  color = "#ffffff",
  tamano = 0.4,
}: ParticulasProps) {
  const contRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cont = contRef.current;
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext("2d");
    if (!cont || !lienzo || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;
    const rgb = hexARgb(color).join(", ");
    const particulas: Particula[] = [];
    const mouse = { x: 0, y: 0 };
    const area = { w: 0, h: 0 };
    let rafId = 0;
    let visible = true;

    const nuevaParticula = (): Particula => ({
      x: Math.random() * area.w,
      y: Math.random() * area.h,
      trasX: 0,
      trasY: 0,
      radio: Math.floor(Math.random() * 2) + tamano,
      alfa: reduce ? Math.random() * 0.6 + 0.1 : 0,
      alfaMeta: Math.random() * 0.6 + 0.1,
      dx: (Math.random() - 0.5) * 0.1,
      dy: (Math.random() - 0.5) * 0.1,
      magnetismo: 0.1 + Math.random() * 4,
    });

    const redimensionar = () => {
      area.w = cont.offsetWidth;
      area.h = cont.offsetHeight;
      lienzo.width = area.w * dpr;
      lienzo.height = area.h * dpr;
      lienzo.style.width = `${area.w}px`;
      lienzo.style.height = `${area.h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particulas.length = 0;
      for (let i = 0; i < cantidad; i++) particulas.push(nuevaParticula());
      if (reduce) pintarEstatico();
    };

    const pintar = (p: Particula) => {
      ctx.save();
      ctx.translate(p.trasX, p.trasY);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb}, ${p.alfa})`;
      ctx.fill();
      ctx.restore();
    };

    const pintarEstatico = () => {
      ctx.clearRect(0, 0, area.w, area.h);
      particulas.forEach(pintar);
    };

    const animar = () => {
      ctx.clearRect(0, 0, area.w, area.h);
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        // desvanecido cerca de los bordes
        const borde = Math.min(
          p.x + p.trasX - p.radio,
          area.w - p.x - p.trasX - p.radio,
          p.y + p.trasY - p.radio,
          area.h - p.y - p.trasY - p.radio
        );
        const factor = Math.max(0, Math.min(1, borde / 20));
        if (factor === 1) {
          p.alfa = Math.min(p.alfa + 0.02, p.alfaMeta);
        } else {
          p.alfa = p.alfaMeta * factor;
        }
        p.x += p.dx;
        p.y += p.dy;
        p.trasX += (mouse.x / (ESTATICIDAD / p.magnetismo) - p.trasX) / SUAVIDAD;
        p.trasY += (mouse.y / (ESTATICIDAD / p.magnetismo) - p.trasY) / SUAVIDAD;
        pintar(p);
        // recicla la que sale del lienzo
        if (
          p.x < -p.radio || p.x > area.w + p.radio ||
          p.y < -p.radio || p.y > area.h + p.radio
        ) {
          particulas[i] = nuevaParticula();
        }
      }
      rafId = window.requestAnimationFrame(animar);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = lienzo.getBoundingClientRect();
      const x = e.clientX - rect.left - area.w / 2;
      const y = e.clientY - rect.top - area.h / 2;
      if (Math.abs(x) < area.w / 2 && Math.abs(y) < area.h / 2) {
        mouse.x = x;
        mouse.y = y;
      }
    };

    redimensionar();
    window.addEventListener("resize", redimensionar);

    if (reduce) {
      // Campo estático: nada de animación, ni listeners de mouse.
      return () => window.removeEventListener("resize", redimensionar);
    }

    window.addEventListener("mousemove", onMouseMove);
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        window.cancelAnimationFrame(rafId);
        if (visible) rafId = window.requestAnimationFrame(animar);
      },
      { threshold: 0.05 }
    );
    io.observe(cont);
    rafId = window.requestAnimationFrame(animar);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", redimensionar);
      window.removeEventListener("mousemove", onMouseMove);
      io.disconnect();
    };
  }, [cantidad, color, tamano]);

  return (
    <div className={`particulas ${className}`.trim()} ref={contRef} aria-hidden="true">
      <canvas ref={lienzoRef} />
    </div>
  );
}
