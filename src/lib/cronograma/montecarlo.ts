// ─────────────────────────────────────────────────────────────────────────
// MONTE CARLO DETERMINISTA sobre el cronograma.
//
// ══ POR QUÉ, SI YA HAY FORMA CERRADA ═══════════════════════════════════════
//
// Porque la forma cerrada no ve el SESGO DE FUSIÓN. Cuando una tarea espera a
// DOS predecesoras, empieza cuando termina la última: max(X, Y). Y
// E[max(X,Y)] > max(E[X], E[Y]) siempre que haya algo de azar — la obra se
// retrasa por la rama que salió mal, y no la compensa la que salió bien. Un
// grafo con muchas confluencias (la placa que espera a todos los espacios, los
// dos oficios paralelos que se vuelven a juntar) tarda de media MÁS que su
// propio camino crítico determinista. La forma cerrada lo ignora; esto lo
// mide, y por eso es lo que alimenta la página del proyecto.
//
// ══ DETERMINISTA: MISMA SEMILLA, MISMA SALIDA ══════════════════════════════
//
// El motor entero es puro y hay un assert que lo vigila. Con `Math.random`
// esto sería imposible: la misma obra daría fechas distintas en cada carga de
// la página. La semilla se deriva del id del proyecto (`aleatorio.ts`), así
// que la obra 42 tiene SIEMPRE la misma simulación — en el servidor, en el
// navegador, hoy y dentro de un año.
//
// ══ CÓMO ══════════════════════════════════════════════════════════════════
//
//  1. Se congela el reparto de cuadrillas del SGS en arcos (`flujo.ts`).
//  2. Se calcula T₀: el total determinista con las MEDIAS PERT. Es la
//     referencia contra la que se mide todo.
//  3. En cada iteración: una Beta-PERT por tarea, UNA por cada espera (el
//     fragüe del pañete es el mismo mortero en toda la obra: se sortea una
//     vez, no una por arista), una pasada CPM hacia adelante O(V+E), y un
//     factor común K para toda la obra.
//  4. D_i = centro · (T_i / T₀) · K_i — anclado al total CALIBRADO del motor.
//     Lo que la simulación aporta es la FORMA; el centro sigue siendo el que
//     los cuatro casos patrón validan.
// ─────────────────────────────────────────────────────────────────────────

import { betaPert, factorComun, xorshift128plus } from "./aleatorio";
import { ordenTopologico } from "./orden";
import {
  distribucionDeMuestras,
  momentosPert,
  PRIOR_SIGMA_COMUN,
  type DistribucionDuracion,
  type TrianguloPERT,
} from "./probabilidad";
import type { Grafo } from "./tipos";

/** Iteraciones por defecto: 2000 basta para percentiles al 1% y cuesta ms. */
export const ITERACIONES_DEFECTO = 2000;

export interface EntradaMonteCarlo {
  /** Grafo YA fijado con los arcos de recurso (`grafoFijado`). */
  grafo: Grafo;
  /** Rango PERT de cada nodo, en días hábiles y con `f` aplicado. */
  rangos: Map<string, TrianguloPERT>;
  /** Rango PERT de cada espera, por etiqueta, en días hábiles. */
  esperas: Map<string, TrianguloPERT>;
  /** Overhead fijo de la obra (`f · O_0`), en días hábiles. */
  overhead: TrianguloPERT;
  /** E[D] calibrado del motor: el ancla de la simulación. */
  centro: number;
  cobertura: number;
  /** Texto del que se deriva la semilla (el id del proyecto). */
  semilla: string;
  iteraciones?: number;
  sigmaComun?: number;
}

export interface ResultadoMonteCarlo {
  /** Lognormal ajustada a las muestras: el mismo contrato que la forma cerrada. */
  distribucion: DistribucionDuracion;
  /** Percentiles EMPÍRICOS (sin suponer forma), en días hábiles. */
  empiricos: { p10: number; p50: number; p80: number; p95: number };
  /** Media simulada en días hábiles. */
  media: number;
  /** E[T]/T₀ − 1: cuánto alarga la obra el sesgo de fusión. */
  sesgoFusion: number;
  iteraciones: number;
  semilla: string;
}

/** Percentil por interpolación lineal sobre la muestra ORDENADA. */
export function percentilEmpirico(ordenadas: number[], q: number): number {
  const n = ordenadas.length;
  if (n === 0) return 0;
  if (n === 1) return ordenadas[0];
  const pos = Math.min(Math.max(q, 0), 1) * (n - 1);
  const i = Math.floor(pos);
  if (i >= n - 1) return ordenadas[n - 1];
  return ordenadas[i] + (pos - i) * (ordenadas[i + 1] - ordenadas[i]);
}

export function simularDuracion(entrada: EntradaMonteCarlo): ResultadoMonteCarlo {
  const { grafo } = entrada;
  const iteraciones = Math.max(1, Math.round(entrada.iteraciones ?? ITERACIONES_DEFECTO));
  const sigmaComun = Math.max(0, entrada.sigmaComun ?? PRIOR_SIGMA_COMUN);

  const orden = ordenTopologico(grafo.nodos, grafo.aristas);
  if (!orden) throw new Error("cronograma: Monte Carlo sobre un grafo con ciclo");

  // ── Estructuras planas: el bucle caliente no toca un Map ────────────────
  const indice = new Map<string, number>(orden.map((id, i) => [id, i]));
  const n = orden.length;
  const rangoO = new Float64Array(n);
  const rangoM = new Float64Array(n);
  const rangoP = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const r = entrada.rangos.get(orden[i]) ?? { o: 0, m: 0, p: 0 };
    rangoO[i] = r.o;
    rangoM[i] = r.m;
    rangoP[i] = r.p;
  }
  // Etiquetas de espera en orden estable: el sorteo tiene que ser reproducible.
  const etiquetas = [...entrada.esperas.keys()].sort();
  const indiceEspera = new Map<string, number>(etiquetas.map((e, i) => [e, i]));
  // Aristas como arrays paralelos, agrupadas por nodo DESTINO.
  const desdeDe: number[] = [];
  const esperaDe: number[] = [];
  const inicioEntradas = new Int32Array(n + 1);
  const porDestino: { desde: number; espera: number }[][] = orden.map(() => []);
  for (const a of grafo.aristas) {
    const d = indice.get(a.desde);
    const h = indice.get(a.hasta);
    if (d === undefined || h === undefined) continue;
    porDestino[h].push({
      desde: d,
      espera: a.espera !== undefined ? indiceEspera.get(a.espera) ?? -1 : -1,
    });
  }
  for (let i = 0; i < n; i++) {
    inicioEntradas[i] = desdeDe.length;
    for (const e of porDestino[i]) {
      desdeDe.push(e.desde);
      esperaDe.push(e.espera);
    }
  }
  inicioEntradas[n] = desdeDe.length;

  // Buffer de fines más tempranos, reutilizado en las M pasadas: se
  // sobrescribe entero en cada una (todo nodo escribe su `ef` antes de que lo
  // lea nadie, porque se recorre en orden topológico).
  const ef = new Float64Array(n);

  /** Una pasada hacia adelante con las duraciones y lags que se le pasen. */
  const pasada = (dur: Float64Array, lag: Float64Array): number => {
    let makespan = 0;
    for (let i = 0; i < n; i++) {
      let es = 0;
      for (let k = inicioEntradas[i]; k < inicioEntradas[i + 1]; k++) {
        const l = esperaDe[k] >= 0 ? lag[esperaDe[k]] : 0;
        const cand = ef[desdeDe[k]] + l;
        if (cand > es) es = cand;
      }
      const fin = es + dur[i];
      ef[i] = fin;
      if (fin > makespan) makespan = fin;
    }
    return makespan;
  };

  // ── T₀: el total determinista con las MEDIAS PERT ───────────────────────
  const mediasDur = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    mediasDur[i] = momentosPert({ o: rangoO[i], m: rangoM[i], p: rangoP[i] }).media;
  }
  const mediasLag = new Float64Array(etiquetas.length);
  for (let i = 0; i < etiquetas.length; i++) {
    mediasLag[i] = momentosPert(entrada.esperas.get(etiquetas[i])!).media;
  }
  const mediaOverhead = momentosPert(entrada.overhead).media;
  const t0 = mediaOverhead + pasada(mediasDur, mediasLag);
  if (!(t0 > 0)) {
    // Obra sin trabajo: no hay nada que simular y no se inventa una campana.
    return {
      distribucion: distribucionDeMuestras([], {
        sigmaComun,
        cobertura: entrada.cobertura,
        tareasEnCadena: 0,
        sesgoFusion: 0,
      }),
      empiricos: { p10: 0, p50: 0, p80: 0, p95: 0 },
      media: 0,
      sesgoFusion: 0,
      iteraciones,
      semilla: entrada.semilla,
    };
  }

  // ── Las M iteraciones ───────────────────────────────────────────────────
  const rng = xorshift128plus(entrada.semilla);
  const dur = new Float64Array(n);
  const lag = new Float64Array(etiquetas.length);
  const muestras: number[] = new Array(iteraciones);
  let sumaT = 0;

  for (let it = 0; it < iteraciones; it++) {
    for (let i = 0; i < etiquetas.length; i++) {
      const r = entrada.esperas.get(etiquetas[i])!;
      lag[i] = betaPert(rng, r.o, r.m, r.p);
    }
    for (let i = 0; i < n; i++) {
      dur[i] = betaPert(rng, rangoO[i], rangoM[i], rangoP[i]);
    }
    const overhead = betaPert(rng, entrada.overhead.o, entrada.overhead.m, entrada.overhead.p);
    const t = overhead + pasada(dur, lag);
    sumaT += t;
    muestras[it] = (entrada.centro * t * factorComun(rng, sigmaComun)) / t0;
  }

  const sesgoFusion = sumaT / iteraciones / t0 - 1;
  const ordenadas = [...muestras].sort((a, b) => a - b);
  let media = 0;
  for (const x of muestras) media += x;
  media /= iteraciones;

  return {
    distribucion: distribucionDeMuestras(muestras, {
      sigmaComun,
      cobertura: entrada.cobertura,
      tareasEnCadena: n,
      sesgoFusion,
    }),
    empiricos: {
      p10: percentilEmpirico(ordenadas, 0.1),
      p50: percentilEmpirico(ordenadas, 0.5),
      p80: percentilEmpirico(ordenadas, 0.8),
      p95: percentilEmpirico(ordenadas, 0.95),
    },
    media,
    sesgoFusion,
    iteraciones,
    semilla: entrada.semilla,
  };
}
