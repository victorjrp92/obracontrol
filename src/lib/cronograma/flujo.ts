// ─────────────────────────────────────────────────────────────────────────
// El GRAFO FIJADO: precedencias + los arcos que impone el REPARTO DE
// CUADRILLAS que el SGS ya decidió.
//
// ══ PARA QUÉ ═══════════════════════════════════════════════════════════════
//
// El CPM a secas supone cuadrillas infinitas: con una obra de 32 baños
// idénticos su camino crítico son los 9 pasos de UN baño, porque los otros 31
// van «en paralelo». Eso está bien como cota inferior y está MAL como base
// para medir incertidumbre: en una obra real con una cuadrilla, los 288 pasos
// se hacen uno detrás de otro y los 288 aportan varianza. Si se mide la
// dispersión sobre el camino del CPM puro, el ancho relativo no decrece con el
// tamaño de la obra — que es exactamente el defecto que este leaf arregla.
//
// La solución estándar (resource-flow network): tomar el reparto que el SGS
// YA calculó y congelarlo como arcos. Si en el plan la cuadrilla general hace
// A, luego B, luego C, se añaden A→B y B→C. Sobre ese grafo, un CPM normal
// reproduce el makespan del SGS y su camino crítico es la CADENA CRÍTICA DE
// RECURSOS: la de verdad, la que se alarga si una tarea se alarga.
//
// Y como el grafo queda FIJO, cada iteración del Monte Carlo es una sola
// pasada hacia adelante O(V+E) en vez de una reprogramación completa. 2000
// iteraciones cuestan milisegundos.
//
// ══ LO QUE ESTE MÓDULO NO PRETENDE ═════════════════════════════════════════
//
// Fijar el reparto es una POLÍTICA, no un óptimo: si en una iteración una
// tarea sale mucho más corta, un programador de verdad reordenaría y el
// makespan bajaría un poco más. Congelar el orden ignora esa reoptimización,
// así que la simulación es LIGERAMENTE conservadora. Es el sesgo correcto:
// en construcción se prefiere errar hacia el lado de la fecha que se cumple.
//
// Con más de una cuadrilla por gremio el SGS reparte tasas fraccionarias y
// dos tareas pueden solaparse; entre ésas no se puede tender un arco de
// secuencia y no se tiende (la condición `fin(u) <= inicio(v)`). El grafo
// queda entonces algo más suelto que la realidad. Los dos call sites del
// producto usan una cuadrilla, donde el reparto es una secuencia exacta.
// ─────────────────────────────────────────────────────────────────────────

import { adyacencia, alcanzable, caminosRestantes, niveles, ordenPrioridad, ordenTopologico } from "./orden";
import type { ResultadoSGS } from "./sgs";
import type { AristaCronograma, Grafo, NodoCronograma } from "./tipos";

/** Los días son fraccionarios: comparar instantes pide tolerancia. */
const EPS = 1e-9;

/**
 * Arcos de SECUENCIA DE RECURSO derivados del plan: dentro de cada pool de
 * gremio, une cada tarea con la siguiente que arranca cuando ella ya terminó.
 * Nunca cierra un ciclo (los arcos van siempre hacia adelante en el tiempo),
 * pero se comprueba igual: un arco de más tumbaría la estimación entera.
 */
export function arcosDeRecurso(grafo: Grafo, plan: ResultadoSGS): AristaCronograma[] {
  const porGremio = new Map<string, NodoCronograma[]>();
  for (const n of grafo.nodos) {
    const lista = porGremio.get(n.gremio);
    if (lista) lista.push(n);
    else porGremio.set(n.gremio, [n]);
  }

  const { salidas } = adyacencia(grafo.nodos, grafo.aristas);
  const nuevos: AristaCronograma[] = [];

  for (const lista of porGremio.values()) {
    const ordenada = [...lista].sort((a, b) => {
      const ia = plan.inicio.get(a.id) ?? 0;
      const ib = plan.inicio.get(b.id) ?? 0;
      if (Math.abs(ia - ib) > EPS) return ia - ib;
      const fa = plan.fin.get(a.id) ?? 0;
      const fb = plan.fin.get(b.id) ?? 0;
      if (Math.abs(fa - fb) > EPS) return fa - fb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    for (let i = 1; i < ordenada.length; i++) {
      const u = ordenada[i - 1];
      const v = ordenada[i];
      const finU = plan.fin.get(u.id) ?? 0;
      const inicioV = plan.inicio.get(v.id) ?? 0;
      // Se solapan (más de una cuadrilla en el pool): no hay secuencia que fijar.
      if (finU > inicioV + EPS) continue;
      if (u.id === v.id || alcanzable(v.id, u.id, salidas)) continue;
      const arco: AristaCronograma = { desde: u.id, hasta: v.id, lag: 0, tipo: "explicita" };
      nuevos.push(arco);
      salidas.get(u.id)?.push(arco);
    }
  }
  return nuevos;
}

/**
 * Grafo de precedencias MÁS los arcos de recurso del plan. Mismos nodos,
 * mismas esperas; solo se le añade el orden que el scheduler ya eligió.
 */
export function grafoFijado(grafo: Grafo, plan: ResultadoSGS): Grafo {
  const aristas = [...grafo.aristas, ...arcosDeRecurso(grafo, plan)];
  const orden = ordenTopologico(grafo.nodos, aristas);
  if (!orden) {
    // Imposible: los arcos de recurso van hacia adelante en el tiempo y pasan
    // por el guardián de alcanzabilidad. Si ocurre es un bug, y se grita.
    throw new Error("cronograma: los arcos de recurso cerraron un ciclo");
  }
  const { entradas, salidas } = adyacencia(grafo.nodos, aristas);
  const nivel = niveles(orden, entradas);
  const caminoRestante = caminosRestantes(
    orden,
    new Map(grafo.nodos.map((n) => [n.id, n])),
    salidas,
  );
  return {
    nodos: grafo.nodos,
    aristas,
    rechazadas: grafo.rechazadas,
    prioridad: ordenPrioridad(grafo.nodos, nivel, caminoRestante),
    nivel,
    caminoRestante,
  };
}
