"use client";

import { useEffect } from "react";

/**
 * Reveals de scroll de la landing Go, por IntersectionObserver (como el
 * mockup): añade `.on` a los `.reveal` al entrar en pantalla y escalona los
 * hijos `[data-esc]` de los contenedores `[data-escalonar="<paso ms>"]`
 * (burbujas del chat, filas de gastos). Con prefers-reduced-motion todo se
 * muestra de una, sin animación.
 */
export default function RevealsGo() {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>(".lgo .reveal"));
    const escalonados = Array.from(
      document.querySelectorAll<HTMLElement>(".lgo [data-escalonar]")
    );

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      reveals.forEach((el) => el.classList.add("on"));
      escalonados.forEach((cont) =>
        cont.querySelectorAll<HTMLElement>("[data-esc]").forEach((it) => it.classList.add("on"))
      );
      return;
    }

    const timeouts: number[] = [];

    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("on");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.18 }
    );
    reveals.forEach((el) => io.observe(el));

    const io2 = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          const cont = e.target as HTMLElement;
          io2.unobserve(cont);
          const paso = Number(cont.dataset.escalonar) || 400;
          cont.querySelectorAll<HTMLElement>("[data-esc]").forEach((it, idx) => {
            timeouts.push(window.setTimeout(() => it.classList.add("on"), 300 + idx * paso));
          });
        });
      },
      { threshold: 0.35 }
    );
    escalonados.forEach((el) => io2.observe(el));

    return () => {
      io.disconnect();
      io2.disconnect();
      timeouts.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
