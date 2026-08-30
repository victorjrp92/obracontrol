// ─────────────────────────────────────────────────────────────────────────
// CPM (nivel 1): la COTA INFERIOR de la obra con recursos infinitos.
//
// Una pasada topológica hacia adelante (ES/EF) y otra hacia atrás (LS/LF).
// La holgura de un nodo es LS − ES; los de holgura cero forman la ruta
// crítica. Con recursos infinitos nadie compite por la cuadrilla, así que lo
// único que manda es la cadena de precedencias más larga: si el CPM dice 40
// días, NINGUNA asignación de cuadrillas puede bajar de 40. Por eso es el
// suelo del invariante D_CPM <= D_SGS <= suma de duraciones.
// ─────────────────────────────────────────────────────────────────────────

import { adyacencia, ordenTopologico } from "./orden";
import type { AristaCronograma, Grafo, NodoCronograma } from "./tipos";

export interface NodoCPM {
  /** Inicio más temprano. */
  es: number;
  /** Fin más temprano. */
  ef: number;
  /** Inicio más tardío sin retrasar la obra. */
  ls: number;
  /** Fin más tardío sin retrasar la obra. */
  lf: number;
  /** Holgura total (LS − ES). Cero = camino crítico. */
  holgura: number;
  critico: boolean;
}

export interface ResultadoCPM {
  /** Duración de la obra con recursos infinitos. */
  makespan: number;
  nodos: Map<string, NodoCPM>;
  /** Un camino crítico real (encadenado), en orden de ejecución. */
  rutaCritica: string[];
}

export interface OpcionesCPM {
  /** Duración de cada nodo (escenario min/probable/max, con `f` aplicado). */
  duracion?: (n: NodoCronograma) => number;
  /** Lag de cada arista (permite apagar esperas). */
  lag?: (a: AristaCronograma) => number;
}

/** Tolerancia de comparación: los días son fraccionarios y hay coma flotante. */
const EPS = 1e-9;

export function calcularCPM(grafo: Grafo, opts: OpcionesCPM = {}): ResultadoCPM {
  const dur = opts.duracion ?? ((n: NodoCronograma) => n.duracion);
  const lag = opts.lag ?? ((a: AristaCronograma) => a.lag);
  const { entradas, salidas } = adyacencia(grafo.nodos, grafo.aristas);
  const orden = ordenTopologico(grafo.nodos, grafo.aristas);
  if (!orden) throw new Error("cronograma: CPM sobre un grafo con ciclo");
  const porId = new Map(grafo.nodos.map((n) => [n.id, n]));

  // Pasada adelante: ES(v) = max sobre predecesores de EF(u) + lag.
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of orden) {
    let inicio = 0;
    for (const a of entradas.get(id) ?? []) {
      inicio = Math.max(inicio, (ef.get(a.desde) ?? 0) + lag(a));
    }
    es.set(id, inicio);
    ef.set(id, inicio + dur(porId.get(id)!));
  }
  let makespan = 0;
  for (const v of ef.values()) makespan = Math.max(makespan, v);

  // Pasada atrás: LF(v) = min sobre sucesores de LS(w) − lag; sumideros al fin.
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (let i = orden.length - 1; i >= 0; i--) {
    const id = orden[i];
    const sucesores = salidas.get(id) ?? [];
    let fin = makespan;
    for (const a of sucesores) fin = Math.min(fin, (ls.get(a.hasta) ?? makespan) - lag(a));
    lf.set(id, fin);
    ls.set(id, fin - dur(porId.get(id)!));
  }

  const nodos = new Map<string, NodoCPM>();
  for (const n of grafo.nodos) {
    const holgura = (ls.get(n.id) ?? 0) - (es.get(n.id) ?? 0);
    nodos.set(n.id, {
      es: es.get(n.id) ?? 0,
      ef: ef.get(n.id) ?? 0,
      ls: ls.get(n.id) ?? 0,
      lf: lf.get(n.id) ?? 0,
      holgura,
      critico: holgura <= EPS,
    });
  }

  // Un camino crítico ENCADENADO (no el conjunto de holgura cero, que puede
  // ser varias cadenas): se arranca del nodo crítico que cierra la obra y se
  // retrocede por el predecesor que lo empuja.
  const ruta: string[] = [];
  let actual: string | null = null;
  let mejorEf = -1;
  for (const n of grafo.nodos) {
    const c = nodos.get(n.id)!;
    if (c.critico && c.ef > mejorEf + EPS) {
      mejorEf = c.ef;
      actual = n.id;
    }
  }
  const visitados = new Set<string>();
  while (actual && !visitados.has(actual)) {
    visitados.add(actual);
    ruta.unshift(actual);
    let anterior: string | null = null;
    for (const a of entradas.get(actual) ?? []) {
      const previo = nodos.get(a.desde);
      if (!previo || !previo.critico) continue;
      if (Math.abs(previo.ef + lag(a) - (nodos.get(actual)!.es ?? 0)) <= EPS) {
        anterior = a.desde;
        break;
      }
    }
    actual = anterior;
  }

  return { makespan, nodos, rutaCritica: ruta };
}
