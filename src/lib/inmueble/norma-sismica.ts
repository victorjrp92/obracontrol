/**
 * Año de construcción → norma sismo resistente que regía cuando se construyó.
 *
 *   < 1984        sin código sísmico nacional
 *   1984 – 1997   CCCSR-84  (Decreto 1400 de 1984)
 *   1998 – 2009   NSR-98    (Ley 400 de 1997, Decreto 33 de 1998)
 *   >= 2010       NSR-10    (Decreto 926 de 2010)
 *
 * ── REGLA DURA: esto informa, NO dictamina ──────────────────────────────────
 * Decir «se construyó antes de que existiera un código sísmico» es un HECHO
 * verificable contra el año. Decir «es peligroso», «no es habitable» o
 * «tiene riesgo» sería un dictamen técnico, y esta aplicación no dictamina:
 * eso lo firma un ingeniero tras una inspección. Ninguna cadena de este
 * archivo emite un juicio sobre el estado del inmueble, y
 * `scripts/verificar-inmueble.ts` lo verifica con la misma regla que
 * `src/lib/alerta/copys.ts` usa para la palabra «seguro».
 *
 * El año tampoco dice cómo se construyó de verdad: dice qué norma regía. Un
 * edificio de 2015 mal construido no cumple la NSR-10 por haber nacido después
 * de ella. Por eso `NOTA_NORMA_SISMICA` (en copys.ts) acompaña siempre a este
 * dato en pantalla y en el documento.
 */
import type { NormaSismica, NormaSismicaId } from "./tipos";

/** Primer año que se acepta. Hay inmuebles coloniales en pie en Cartagena y Popayán. */
export const ANIO_MIN_CONSTRUCCION = 1500;

/**
 * Último año aceptado: el que viene. Una obra que se termina el año próximo ya
 * se registra hoy. Se calcula en cada llamada, no en una constante de módulo:
 * un proceso de larga vida no debe quedarse con el año congelado del arranque.
 */
export function anioMaximoConstruccion(): number {
  return new Date().getFullYear() + 1;
}

/** Años exactos en que cambia el tramo. El de 1984 es el primer año CON código. */
export const ANIO_CCCSR_84 = 1984;
export const ANIO_NSR_98 = 1998;
export const ANIO_NSR_10 = 2010;

export const NORMAS_SISMICAS: Record<NormaSismicaId, NormaSismica> = {
  sin_codigo: {
    id: "sin_codigo",
    etiqueta: "Sin código sísmico",
    vigencia: "antes de 1984",
    frase:
      "En esa fecha Colombia todavía no tenía un código nacional de construcción sismo resistente: el primero fue el CCCSR-84, de 1984.",
  },
  cccsr_84: {
    id: "cccsr_84",
    etiqueta: "CCCSR-84",
    vigencia: "1984 a 1997",
    frase:
      "Le aplicaba el CCCSR-84 (Decreto 1400 de 1984), el primer código colombiano de construcción sismo resistente.",
  },
  nsr_98: {
    id: "nsr_98",
    etiqueta: "NSR-98",
    vigencia: "1998 a 2009",
    frase: "Le aplicaba la NSR-98 (Ley 400 de 1997, Decreto 33 de 1998).",
  },
  nsr_10: {
    id: "nsr_10",
    etiqueta: "NSR-10",
    vigencia: "desde 2010",
    frase: "Le aplicaba la NSR-10 (Decreto 926 de 2010), la norma vigente hoy.",
  },
};

/**
 * Devuelve la norma que regía ese año, o `null` si no hay año o el año está
 * fuera del rango aceptado. `null` significa «no lo sé», nunca un tramo por
 * defecto: inventar una norma es peor que no mostrar ninguna.
 */
export function normaSismicaPorAnio(anio: number | null | undefined): NormaSismica | null {
  if (typeof anio !== "number" || !Number.isInteger(anio)) return null;
  if (anio < ANIO_MIN_CONSTRUCCION || anio > anioMaximoConstruccion()) return null;

  if (anio < ANIO_CCCSR_84) return NORMAS_SISMICAS.sin_codigo;
  if (anio < ANIO_NSR_98) return NORMAS_SISMICAS.cccsr_84;
  if (anio < ANIO_NSR_10) return NORMAS_SISMICAS.nsr_98;
  return NORMAS_SISMICAS.nsr_10;
}

/**
 * La frase completa para el documento, con el año adentro:
 * «Construido en 1979. Se construyó antes de 1984, cuando…».
 */
export function fraseNormaSismica(anio: number | null | undefined): string | null {
  const norma = normaSismicaPorAnio(anio);
  if (!norma) return null;
  return `Construido en ${anio}. ${norma.frase}`;
}

/** Todos los tramos, en orden cronológico. Para pintar una tabla de referencia. */
export const TRAMOS_NORMA_SISMICA: NormaSismica[] = [
  NORMAS_SISMICAS.sin_codigo,
  NORMAS_SISMICAS.cccsr_84,
  NORMAS_SISMICAS.nsr_98,
  NORMAS_SISMICAS.nsr_10,
];
