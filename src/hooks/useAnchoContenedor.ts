"use client";

// ---------------------------------------------------------------------------
// Ancho real, en pixeles, del elemento que envuelve una grafica.
//
// Existe por un error que se ve enseguida y se explica mal: un SVG con
// `viewBox` fijo y `width: 100%` no se ADAPTA al contenedor, se ESCALA. En una
// pantalla ancha el contenedor mide el doble que el viewBox, y con el se
// duplica todo lo que va adentro: la letra de 10 px sale de 20, los puntos de
// 4 px se vuelven de 8, y una grafica de 180 px de alto ocupa 400.
//
// La salida es hacer que una unidad del SVG sea exactamente un pixel: se mide
// el contenedor y se le da al viewBox ese mismo ancho. Asi la letra mide lo
// que dice medir en cualquier pantalla, y la grafica se estira a lo ancho sin
// engordar.
//
// Antes de la primera medida -en el servidor y en el primer pintado- devuelve
// un ancho de respaldo para que el SVG exista y no salte de cero al montarse.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

/** Ancho con el que se pinta mientras no se ha medido nada. */
export const ANCHO_RESPALDO = 720;

export function useAnchoContenedor<T extends HTMLElement>(respaldo = ANCHO_RESPALDO) {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(respaldo);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      // Un contenedor oculto mide cero; con cero de viewBox el SVG desaparece.
      if (w > 0) setAncho(w);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ancho };
}
