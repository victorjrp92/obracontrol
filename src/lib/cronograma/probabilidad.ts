// ─────────────────────────────────────────────────────────────────────────
// DISTRIBUCIÓN de la duración de la obra: de tres escenarios a PERCENTILES.
//
// ══ EL DEFECTO QUE ARREGLA ═════════════════════════════════════════════════
//
// Hasta aquí el motor devolvía `{min, probable, max}` construidos como tres
// escenarios COMONOTÓNICOS: `min` supone que TODAS las tareas van rápidas a la
// vez y `max` que TODAS van lentas. Eso es correlación perfecta, y se nota: el
// ancho relativo del intervalo salía PLANO —del orden del 74–100%— con 9, 18,
// 36, 72, 144 y 288 tareas. Con errores parcialmente independientes tiene que
// DECRECER con el número de tareas, porque los que sobran se compensan entre
// sí. Un intervalo de ±37% en una casa de cien tareas no es información.
//
// Y esos tres números no eran percentiles de nada, así que con ellos era
// imposible decir «hay un 80% de probabilidad de terminar antes del 3 de
// noviembre» — que es justo la única frase que el usuario necesita.
//
// ══ EL MODELO ══════════════════════════════════════════════════════════════
//
//     D = K · S        S = Σ_{t ∈ cadena crítica} D_t + Λ
//     K ~ LogNormal(−σ_K²/2, σ_K²)      (media exactamente 1)
//
//     CV²[D] = (σ_S²/μ_S²)·e^{σ_K²}  +  (e^{σ_K²} − 1)
//               └ idiosincrático        └ COMÚN, no decae
//                 decae como 1/N
//
// El primer término es el error de cada tarea, que se promedia: con cuatro
// veces más tareas, la mitad de ancho. El segundo es el PISO IRREDUCIBLE: las
// causas que afectan a la obra ENTERA a la vez —el invierno, la caja del
// cliente, esta cuadrilla en concreto— no se promedian con nada. Por muchas
// tareas que tenga la obra: si el cliente no paga, la obra para.
//
// Por tarea, PERT clásica sobre el rango de rendimientos que la semilla YA
// traía (`min`, `porDia`, `max`): la materia prima estaba, solo se propagaba
// mal.
//
//     μ_t = (o + 4·m̃ + p)/6           σ_t = (p − o)/6
//
// ══ HONESTIDAD SOBRE σ_K ═══════════════════════════════════════════════════
//
// σ_K = 0.25 es un **prior de literatura**, NO una medición de Seiricon. No
// hay ni una obra terminada con `dias_motor` guardado contra la que estimarlo
// (docs/specs/algoritmo-duracion.md §10.2). Es el número que hace que el motor
// prometa ±25% en vez de ±10%: prometer ±10% sería mentir. Cuando haya ~30
// obras cerradas se estima de los datos y este prior se retira.
// ─────────────────────────────────────────────────────────────────────────

import { phi, zDe } from "./normal";

/** Prior de literatura del factor común. NO es una medición de Seiricon. */
export const PRIOR_SIGMA_COMUN = 0.25;

/**
 * Inflado de σ para las tareas SIN rendimiento investigado (`conDato =
 * false`): su banda no sale de una fuente, sale de los días que escribió el
 * usuario. Es juicio, no medición, y por eso además se reporta la `cobertura`
 * — el usuario tiene derecho a saber sobre cuánto dato descansa su fecha.
 */
export const FACTOR_SIGMA_SIN_DATO = 1.5;

/** Rango de una magnitud: optimista, moda, pesimista. */
export interface TrianguloPERT {
  /** Optimista (`o`): lo que dura si todo sale bien. */
  o: number;
  /** Moda (`m̃`): lo más probable. */
  m: number;
  /** Pesimista (`p`). */
  p: number;
}

export interface MomentosPERT {
  /** μ = (o + 4·m̃ + p)/6. */
  media: number;
  /** σ = (p − o)/6. */
  sigma: number;
}

/**
 * Rango efectivo de una tarea. Si NO tiene rendimiento investigado, se
 * ENSANCHA alrededor de la moda por `FACTOR_SIGMA_SIN_DATO` (σ sube en esa
 * proporción exacta, porque σ es proporcional a p − o).
 *
 * El ensanchado se hace UNA vez, aquí, sobre el rango: así la forma cerrada y
 * el Monte Carlo trabajan sobre la MISMA banda y no pueden desincronizarse.
 * Un `o` negativo no significa nada —una tarea no dura menos que cero— así
 * que se recorta en 0.
 */
export function rangoAjustado(t: TrianguloPERT, conDato: boolean): TrianguloPERT {
  if (conDato) return t;
  const k = FACTOR_SIGMA_SIN_DATO;
  return {
    o: Math.max(0, t.m - k * (t.m - t.o)),
    m: t.m,
    p: t.m + k * (t.p - t.m),
  };
}

/** Momentos PERT de un rango YA ajustado (ver `rangoAjustado`). */
export function momentosPert(t: TrianguloPERT): MomentosPERT {
  return { media: (t.o + 4 * t.m + t.p) / 6, sigma: Math.max(0, (t.p - t.o) / 6) };
}

export type OrigenDistribucion = "cerrada" | "montecarlo";

/**
 * La duración de la obra como VARIABLE ALEATORIA, ajustada a una lognormal.
 * Es el contrato que sustituye a `{min, probable, max}`.
 *
 * Todos los días son HÁBILES. Lo que se le enseña al usuario NO es ninguno de
 * estos números: es una FECHA (ver `fechas.ts`), y eso elimina de raíz la
 * ambigüedad hábiles/calendario que contaminaba la interfaz.
 */
export interface DistribucionDuracion {
  /** Cómo se obtuvo: forma cerrada o simulación. */
  origen: OrigenDistribucion;
  /** E[D] en días hábiles: el centro calibrado del motor. */
  media: number;
  /** Parámetros de la lognormal ajustada. */
  muLn: number;
  sigmaLn: number;
  /** Coeficiente de variación total y sus dos componentes. */
  cv: number;
  /** Parte que DECAE como 1/N (errores de tarea, independientes). */
  cvIdiosincratico: number;
  /** Parte que NO decae: el piso irreducible del factor común. */
  cvComun: number;
  /** σ_K usado. */
  sigmaComun: number;
  /** Percentiles en días hábiles. */
  p10: number;
  p50: number;
  p80: number;
  p95: number;
  /** Fracción 0–1 de tareas con rendimiento investigado. */
  cobertura: number;
  /** Tareas que aportan varianza (la cadena crítica): el N efectivo. */
  tareasEnCadena: number;
  /**
   * Sesgo de fusión E[max(X,Y)] − max(E[X],E[Y]), como fracción del centro.
   * Solo lo puede medir el Monte Carlo; la forma cerrada lo deja en 0 y por
   * eso subestima un poco la media en grafos con muchas confluencias.
   */
  sesgoFusion: number;
}

export interface EntradaDistribucion {
  /** E[D]: el total calibrado del motor, sin redondear. */
  media: number;
  /** σ del componente idiosincrático, en días hábiles. */
  sigmaIdiosincratico: number;
  /** σ_K. Por defecto `PRIOR_SIGMA_COMUN`. */
  sigmaComun?: number;
  cobertura: number;
  tareasEnCadena: number;
}

/** Arma la distribución a partir de (media, CV total) y sus componentes. */
function armar(params: {
  origen: OrigenDistribucion;
  media: number;
  sigmaLn: number;
  sigmaComun: number;
  cvIdiosincratico: number;
  cobertura: number;
  tareasEnCadena: number;
  sesgoFusion: number;
  /** Si viene, manda sobre `media` para fijar la lognormal (ajuste MC). */
  muLn?: number;
}): DistribucionDuracion {
  const sigmaLn = Math.max(0, params.sigmaLn);
  const cvComun = Math.sqrt(Math.max(0, Math.exp(params.sigmaComun ** 2) - 1));

  // Obra sin trabajo: no hay campana que ajustar. Devolver percentiles de una
  // lognormal centrada en «casi cero» sería inventarse una distribución donde
  // no hay ninguna, así que se devuelven ceros limpios.
  if (params.muLn === undefined && !(params.media > 0)) {
    return {
      origen: params.origen,
      media: 0,
      muLn: 0,
      sigmaLn: 0,
      cv: 0,
      cvIdiosincratico: 0,
      cvComun,
      sigmaComun: params.sigmaComun,
      p10: 0,
      p50: 0,
      p80: 0,
      p95: 0,
      cobertura: params.cobertura,
      tareasEnCadena: params.tareasEnCadena,
      sesgoFusion: params.sesgoFusion,
    };
  }

  const muLn =
    params.muLn !== undefined
      ? params.muLn
      : Math.log(params.media) - (sigmaLn * sigmaLn) / 2;
  const cv = Math.sqrt(Math.max(0, Math.exp(sigmaLn * sigmaLn) - 1));
  const cuantil = (q: number): number => Math.exp(muLn + zDe(q) * sigmaLn);

  return {
    origen: params.origen,
    media: Math.exp(muLn + (sigmaLn * sigmaLn) / 2),
    muLn,
    sigmaLn,
    cv,
    cvIdiosincratico: params.cvIdiosincratico,
    cvComun,
    sigmaComun: params.sigmaComun,
    p10: cuantil(0.1),
    p50: cuantil(0.5),
    p80: cuantil(0.8),
    p95: cuantil(0.95),
    cobertura: params.cobertura,
    tareasEnCadena: params.tareasEnCadena,
    sesgoFusion: params.sesgoFusion,
  };
}

/**
 * FORMA CERRADA. Combina el error idiosincrático con el factor común y ajusta
 * una lognormal de media `entrada.media`.
 *
 *     CV²[D] = CV_S²·e^{σ_K²} + (e^{σ_K²} − 1)
 *     σ_ln   = sqrt( ln(1 + CV²[D]) )        μ_ln = ln(E[D]) − σ_ln²/2
 *
 * Con N grande CV_S → 0 y σ_ln → σ_K: el ancho relativo aterriza exactamente
 * en el prior del factor común, que es el piso que no se puede bajar.
 */
export function distribucionCerrada(entrada: EntradaDistribucion): DistribucionDuracion {
  const media = Math.max(0, entrada.media);
  const sigmaComun = Math.max(0, entrada.sigmaComun ?? PRIOR_SIGMA_COMUN);
  const cvS = media > 0 ? Math.max(0, entrada.sigmaIdiosincratico) / media : 0;
  const expK = Math.exp(sigmaComun * sigmaComun);
  const cv2 = cvS * cvS * expK + (expK - 1);
  const sigmaLn = Math.sqrt(Math.log(1 + cv2));
  return armar({
    origen: "cerrada",
    media,
    sigmaLn,
    sigmaComun,
    cvIdiosincratico: cvS,
    cobertura: entrada.cobertura,
    tareasEnCadena: entrada.tareasEnCadena,
    sesgoFusion: 0,
  });
}

/**
 * Ajusta una lognormal a MUESTRAS (las del Monte Carlo) por los momentos de
 * sus logaritmos, que es el estimador de máxima verosimilitud. Así el Monte
 * Carlo devuelve el MISMO contrato que la forma cerrada y `probabilidadHasta`
 * sirve igual para los dos.
 */
export function distribucionDeMuestras(
  muestras: number[],
  extra: {
    sigmaComun: number;
    cobertura: number;
    tareasEnCadena: number;
    sesgoFusion: number;
  },
): DistribucionDuracion {
  const validas = muestras.filter((x) => x > 0);
  if (validas.length === 0) {
    return armar({
      origen: "montecarlo",
      media: 0,
      sigmaLn: 0,
      sigmaComun: extra.sigmaComun,
      cvIdiosincratico: 0,
      cobertura: extra.cobertura,
      tareasEnCadena: extra.tareasEnCadena,
      sesgoFusion: extra.sesgoFusion,
    });
  }
  let suma = 0;
  for (const x of validas) suma += Math.log(x);
  const muLn = suma / validas.length;
  let suma2 = 0;
  for (const x of validas) {
    const d = Math.log(x) - muLn;
    suma2 += d * d;
  }
  const sigmaLn = Math.sqrt(suma2 / validas.length);
  const expK = Math.exp(extra.sigmaComun ** 2);
  const cv2 = Math.exp(sigmaLn * sigmaLn) - 1;
  // Se despeja la parte idiosincrática de la misma identidad de la forma
  // cerrada, para poder compararlas término a término.
  const cvIdio = Math.sqrt(Math.max(0, (cv2 - (expK - 1)) / expK));
  return armar({
    origen: "montecarlo",
    media: 0,
    muLn,
    sigmaLn,
    sigmaComun: extra.sigmaComun,
    cvIdiosincratico: cvIdio,
    cobertura: extra.cobertura,
    tareasEnCadena: extra.tareasEnCadena,
    sesgoFusion: extra.sesgoFusion,
  });
}

/** Percentil `q` (0–1) en días hábiles: D_q = exp(μ_ln + z_q·σ_ln). */
export function percentil(d: DistribucionDuracion, q: number): number {
  return Math.exp(d.muLn + zDe(q) * d.sigmaLn);
}

/**
 * P(D ≤ x): la probabilidad de terminar en `dias` días hábiles o menos.
 * Φ((ln x − μ_ln)/σ_ln). Monótona en `dias` y exactamente inversa de
 * `percentil` (ver `normal.ts`), así que `probabilidadHasta(d, d.p80) = 0.80`.
 */
export function probabilidadHasta(d: DistribucionDuracion, dias: number): number {
  if (!(dias > 0)) return 0;
  if (d.sigmaLn <= 0) return dias >= Math.exp(d.muLn) ? 1 : 0;
  return phi((Math.log(dias) - d.muLn) / d.sigmaLn);
}

/**
 * ANCHO RELATIVO del intervalo: σ_ln, la dispersión relativa de la lognormal.
 *
 * Es la cifra que este módulo existe para bajar. Con el modelo comonotónico
 * viejo era PLANA (~74–100% medido como (max−min)/probable) tuviera la obra 9
 * tareas o 288; aquí DECRECE con el número de tareas y se estabiliza en σ_K.
 */
export function anchoRelativo(d: DistribucionDuracion): number {
  return d.sigmaLn;
}
