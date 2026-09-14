"use client";

import ReactDOM from "react-dom";

/**
 * Precarga de Figtree, la fuente de todo el producto.
 *
 * El @font-face vive en globals.css con font-display:swap. Sin esta pista, el
 * navegador no descubre el woff2 hasta haber descargado y parseado la hoja de
 * estilos, así que la primera pintura sale con la fuente de respaldo y luego
 * reflúe: Figtree es ~3% más estrecha y su altura de x es ~7% menor que la de
 * system-ui, o sea que el salto se ve.
 *
 * Va como componente cliente porque es lo que documenta Next 16 para
 * `<link rel="preload">` (guía de generate-metadata, «Resource hints»): en el
 * layout raíz NO se deben escribir etiquetas de <head> a mano.
 *
 * `crossOrigin: "anonymous"` es obligatorio aunque el archivo sea del mismo
 * origen: las fuentes se piden siempre en modo CORS y, sin el atributo, la
 * precarga y la petición real no coinciden y el woff2 se descarga dos veces.
 */
export default function PrecargaFuente() {
  ReactDOM.preload("/fonts/figtree/figtree-latin.woff2", {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  });

  return null;
}
