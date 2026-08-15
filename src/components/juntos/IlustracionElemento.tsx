import Image from "next/image";
import type { Elemento } from "@/lib/alerta/tipos";

/**
 * Tarjetas para ubicar la grieta (spec-go-juntos.md, §Ilustraciones).
 *
 * Decisión de Victor tras comparar cuatro enfoques: **foto anotada + esquema**.
 * La foto da el reconocimiento ("eso se parece a lo mío") y las anotaciones
 * rojas — lenguaje de plano marcado a mano — lo hacen práctico de leer al
 * instante; el esquema de la esquina dice qué pieza es cuando la tarjeta se ve
 * pequeña. Las fotos son generadas con IA (sin rostros, ver CREDITS.md) porque
 * el banco de imágenes no distinguía muro de carga de muro divisorio: la clave
 * es la profundidad de la jamba en el vano, y eso hubo que componerlo.
 */

/** Los 7 elementos que se ofrecen en el Paso 1 (los demás solo los alcanza el modelo). */
export type ElementoTarjeta = Extract<
  Elemento,
  "columna" | "viga" | "muro_carga" | "muro_divisorio" | "losa_techo" | "piso" | "no_determinado"
>;

/** Nota de una línea bajo cada tarjeta (lenguaje llano). */
export const NOTA_ELEMENTO: Record<ElementoTarjeta, string> = {
  columna: "Vertical y gruesa: sostiene el techo.",
  viga: "Horizontal, arriba: cruza de pared a pared.",
  muro_carga: "Grueso (25-30 cm): sostiene la casa.",
  muro_divisorio: "Delgado (10 cm): solo separa espacios.",
  losa_techo: "La plancha sobre tu cabeza.",
  piso: "La superficie donde caminas.",
  no_determinado: "Si dudas, elige esto — así no se subestima el resultado.",
};

/** Foto anotada por elemento (public/landing/juntos/elementos). */
const FOTO: Record<Exclude<ElementoTarjeta, "no_determinado">, string> = {
  columna: "elem-columna",
  viga: "elem-viga",
  muro_carga: "elem-muro-carga",
  muro_divisorio: "elem-muro-divisorio",
  losa_techo: "elem-techo",
  piso: "elem-piso",
};

/**
 * Esquema del sello: la pieza en índigo dentro de una casa simplificada. Se lee
 * aunque la foto se vea diminuta, y no depende del texto quemado en la imagen.
 */
function Esquema({ elemento }: { elemento: ElementoTarjeta }) {
  const g = { fill: "#EEF1F6", stroke: "#0B1220", strokeWidth: 1.4 };
  const a = { fill: "#2563EB", stroke: "#0B1220", strokeWidth: 1.4 };
  const s = { fill: "#DCE6FB", stroke: "#2563EB", strokeWidth: 1.4 };

  return (
    <svg viewBox="0 0 40 40" className="esquema" aria-hidden="true" focusable="false">
      {elemento === "columna" && (
        <>
          <rect x="2" y="4" width="36" height="5" {...g} />
          <rect x="2" y="32" width="36" height="5" {...g} />
          <rect x="15" y="9" width="10" height="23" {...a} />
        </>
      )}
      {elemento === "viga" && (
        <>
          <rect x="2" y="3" width="36" height="4" {...g} />
          <rect x="4" y="9" width="32" height="8" {...a} />
          <rect x="6" y="17" width="6" height="20" {...g} />
          <rect x="28" y="17" width="6" height="20" {...g} />
        </>
      )}
      {elemento === "muro_carga" && (
        <>
          <rect x="2" y="4" width="36" height="4" {...g} />
          <rect x="2" y="33" width="36" height="4" {...g} />
          <rect x="11" y="8" width="18" height="25" {...a} />
        </>
      )}
      {elemento === "muro_divisorio" && (
        <>
          <rect x="2" y="4" width="36" height="4" {...g} />
          <rect x="2" y="33" width="36" height="4" {...g} />
          <rect x="17" y="8" width="6" height="25" {...s} />
        </>
      )}
      {elemento === "losa_techo" && (
        <>
          <rect x="2" y="4" width="36" height="9" {...a} />
          <rect x="5" y="13" width="6" height="24" {...g} />
          <rect x="29" y="13" width="6" height="24" {...g} />
        </>
      )}
      {elemento === "piso" && (
        <>
          <rect x="2" y="28" width="36" height="9" {...a} />
          <rect x="5" y="5" width="6" height="23" {...g} />
          <rect x="29" y="5" width="6" height="23" {...g} />
        </>
      )}
    </svg>
  );
}

export default function IlustracionElemento({ elemento }: { elemento: ElementoTarjeta }) {
  // «No estoy seguro» no lleva foto: un signo de interrogación grande y limpio.
  if (elemento === "no_determinado") {
    return (
      <span className="ilu ilu-duda" aria-hidden="true">
        ?
      </span>
    );
  }

  return (
    <span className="ilu">
      <Image
        src={`/landing/juntos/elementos/${FOTO[elemento]}.jpg`}
        alt=""
        width={900}
        height={675}
        sizes="(max-width: 640px) 45vw, 200px"
      />
      <span className="ilu-sello">
        <Esquema elemento={elemento} />
      </span>
    </span>
  );
}
