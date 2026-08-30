// ─────────────────────────────────────────────────────────────────────────
// Orden topológico (Kahn), niveles, camino restante y ORDEN DE PRIORIDAD.
//
// Kahn detecta ciclos en O(V+E) —si sobran nodos al vaciar la cola, hay
// ciclo— y es lo que usa `construirGrafo` para rechazar una arista explícita
// que cierre uno.
//
// La PRIORIDAD del scheduler sale del grafo, no de una lista escrita a mano,
// y es totalmente determinista:
//   1. nivel topológico ascendente  → línea de balance: la cuadrilla estuca
//      TODOS los espacios antes de pintar el primero. Ordenar por nivel es
//      un orden topológico válido (toda arista sube al menos un nivel).
//   2. camino restante más largo    → primero lo que más cola arrastra.
//   3. orden de fase ascendente     → a igualdad, el orden constructivo.
//   4. id                           → desempate final; no hay empates reales.
// ─────────────────────────────────────────────────────────────────────────

import type { AristaCronograma, NodoCronograma } from "./tipos";

export interface Adyacencia {
  /** Aristas que SALEN de cada nodo. */
  salidas: Map<string, AristaCronograma[]>;
  /** Aristas que ENTRAN a cada nodo. */
  entradas: Map<string, AristaCronograma[]>;
}

export function adyacencia(nodos: NodoCronograma[], aristas: AristaCronograma[]): Adyacencia {
  const salidas = new Map<string, AristaCronograma[]>();
  const entradas = new Map<string, AristaCronograma[]>();
  for (const n of nodos) {
    salidas.set(n.id, []);
    entradas.set(n.id, []);
  }
  for (const a of aristas) {
    salidas.get(a.desde)?.push(a);
    entradas.get(a.hasta)?.push(a);
  }
  return { salidas, entradas };
}

/**
 * Orden topológico por Kahn. Devuelve `null` si el grafo tiene un ciclo
 * (quedan nodos con grado de entrada > 0 al vaciar la cola). Determinista:
 * la cola respeta el orden de `nodos`, no el de un Set.
 */
export function ordenTopologico(
  nodos: NodoCronograma[],
  aristas: AristaCronograma[],
): string[] | null {
  const { salidas } = adyacencia(nodos, aristas);
  const grado = new Map<string, number>();
  for (const n of nodos) grado.set(n.id, 0);
  for (const a of aristas) grado.set(a.hasta, (grado.get(a.hasta) ?? 0) + 1);

  const cola: string[] = nodos.filter((n) => (grado.get(n.id) ?? 0) === 0).map((n) => n.id);
  const orden: string[] = [];
  for (let i = 0; i < cola.length; i++) {
    const id = cola[i];
    orden.push(id);
    for (const a of salidas.get(id) ?? []) {
      const g = (grado.get(a.hasta) ?? 0) - 1;
      grado.set(a.hasta, g);
      if (g === 0) cola.push(a.hasta);
    }
  }
  return orden.length === nodos.length ? orden : null;
}

/**
 * ¿Existe camino de `origen` a `destino`? Recorrido en anchura sobre las
 * aristas ya aceptadas. Se usa para rechazar una arista explícita ANTES de
 * añadirla: si ya se llega de `hasta` a `desde`, la arista cerraría un ciclo.
 */
export function alcanzable(
  origen: string,
  destino: string,
  salidas: Map<string, AristaCronograma[]>,
): boolean {
  if (origen === destino) return true;
  const vistos = new Set<string>([origen]);
  const cola: string[] = [origen];
  for (let i = 0; i < cola.length; i++) {
    for (const a of salidas.get(cola[i]) ?? []) {
      if (a.hasta === destino) return true;
      if (!vistos.has(a.hasta)) {
        vistos.add(a.hasta);
        cola.push(a.hasta);
      }
    }
  }
  return false;
}

/** Nivel topológico: longitud EN NODOS del camino más largo que llega a él. */
export function niveles(
  orden: string[],
  entradas: Map<string, AristaCronograma[]>,
): Map<string, number> {
  const nivel = new Map<string, number>();
  for (const id of orden) {
    let n = 0;
    for (const a of entradas.get(id) ?? []) n = Math.max(n, (nivel.get(a.desde) ?? 0) + 1);
    nivel.set(id, n);
  }
  return nivel;
}

/**
 * Camino restante más largo desde cada nodo hasta un sumidero, contando su
 * propia duración y los lags que atraviesa. Es la cola de trabajo que arrastra
 * cada tarea: la prioridad clásica «LPT / most total successors work».
 */
export function caminosRestantes(
  orden: string[],
  nodos: Map<string, NodoCronograma>,
  salidas: Map<string, AristaCronograma[]>,
): Map<string, number> {
  const restante = new Map<string, number>();
  for (let i = orden.length - 1; i >= 0; i--) {
    const id = orden[i];
    let cola = 0;
    for (const a of salidas.get(id) ?? []) {
      cola = Math.max(cola, a.lag + (restante.get(a.hasta) ?? 0));
    }
    restante.set(id, (nodos.get(id)?.duracion ?? 0) + cola);
  }
  return restante;
}

/**
 * Lista de prioridad del scheduler. Es un orden topológico válido —ordenar
 * por nivel nunca pone un sucesor antes que su predecesor— y además
 * determinista hasta el último desempate.
 */
export function ordenPrioridad(
  nodos: NodoCronograma[],
  nivel: Map<string, number>,
  caminoRestante: Map<string, number>,
): string[] {
  return [...nodos]
    .sort((a, b) => {
      const na = nivel.get(a.id) ?? 0;
      const nb = nivel.get(b.id) ?? 0;
      if (na !== nb) return na - nb;
      const ca = caminoRestante.get(a.id) ?? 0;
      const cb = caminoRestante.get(b.id) ?? 0;
      if (Math.abs(ca - cb) > 1e-9) return cb - ca;
      if (a.ordenFase !== b.ordenFase) return a.ordenFase - b.ordenFase;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .map((n) => n.id);
}
