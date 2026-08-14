import type { Elemento } from "@/lib/alerta/tipos";

/**
 * Ilustraciones didácticas para ubicar la grieta (spec-go-juntos.md,
 * sección Ilustraciones): nada de fotos — SVG esquemáticos propios, la misma
 * casa en corte en todas las tarjetas con el elemento resaltado en índigo y
 * una grieta indicativa encima. Estilo Aizome: trazo tinta 2px, relleno
 * índigo suave, esquinas rectas (las clases .trazo/.suave/.resalte/.grieta
 * viven en landing-juntos.css).
 */

/** Los 7 elementos que se ofrecen en el Paso 1 (los demás solo los alcanza el modelo). */
export type ElementoTarjeta = Extract<
  Elemento,
  "columna" | "viga" | "muro_carga" | "muro_divisorio" | "losa_techo" | "piso" | "no_determinado"
>;

/** Nota de una línea bajo cada tarjeta (lenguaje llano). */
export const NOTA_ELEMENTO: Record<ElementoTarjeta, string> = {
  columna: "Vertical y gruesa: sostiene el techo.",
  viga: "Horizontal, arriba: carga el techo o el piso de arriba.",
  muro_carga: "Suele ser más grueso y sostiene el techo.",
  muro_divisorio: "Delgado: solo separa espacios, no sostiene.",
  losa_techo: "La plancha del techo o del piso de arriba.",
  piso: "La superficie sobre la que caminas.",
  no_determinado: "Si dudas, elige esto — así no se subestima el resultado.",
};

type Pieza = "losa" | "viga" | "colIzq" | "colDer" | "muroCarga" | "muroDiv" | "piso";

/** Qué pieza de la casa se resalta por tarjeta (null = ninguna, caso "no estoy seguro"). */
const RESALTE: Record<ElementoTarjeta, Pieza | null> = {
  columna: "colIzq",
  viga: "viga",
  muro_carga: "muroCarga",
  muro_divisorio: "muroDiv",
  losa_techo: "losa",
  piso: "piso",
  no_determinado: null,
};

/** Grieta indicativa (polyline) sobre la pieza resaltada. */
const GRIETA: Record<Exclude<Pieza, never>, string> = {
  colIzq: "24,42 20,54 26,66 22,80",
  viga: "62,21 67,24 64,27 69,28",
  losa: "72,11 76,15 73,19",
  muroCarga: "52,44 47,58 53,72 49,88",
  muroDiv: "86,50 83,64 88,78",
  piso: "58,101 64,103 61,105",
  colDer: "116,42 113,56 118,70",
};

export default function IlustracionElemento({ elemento }: { elemento: ElementoTarjeta }) {
  const resalte = RESALTE[elemento];
  const cls = (pieza: Pieza) => (pieza === resalte ? "resalte" : "suave");

  return (
    <svg viewBox="0 0 140 112" className="ilu" aria-hidden="true" focusable="false">
      {/* Casa en corte: losa de techo, viga, dos columnas, muro que sostiene
          (grueso), muro divisorio (delgado) y piso, sobre la línea de suelo. */}
      <line x1="2" y1="108" x2="138" y2="108" className="trazo" />
      <rect x="8" y="10" width="124" height="10" className={cls("losa")} />
      <rect x="18" y="20" width="104" height="8" className={cls("viga")} />
      <rect x="18" y="28" width="10" height="72" className={cls("colIzq")} />
      <rect x="112" y="28" width="10" height="72" className={cls("colDer")} />
      <rect x="44" y="28" width="14" height="72" className={cls("muroCarga")} />
      <rect x="84" y="28" width="5" height="72" className={cls("muroDiv")} />
      <rect x="8" y="100" width="124" height="6" className={cls("piso")} />

      {resalte ? (
        <polyline points={GRIETA[resalte]} className="grieta" />
      ) : (
        <text
          x="70"
          y="78"
          textAnchor="middle"
          style={{ fill: "var(--azul)", fontFamily: "inherit", fontWeight: 800, fontSize: 40 }}
        >
          ?
        </text>
      )}
    </svg>
  );
}
