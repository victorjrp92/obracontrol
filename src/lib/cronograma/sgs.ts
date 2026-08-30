// ─────────────────────────────────────────────────────────────────────────
// SGS serial (nivel 2): la programación REAL, con cuadrillas finitas.
//
// El CPM da el suelo con recursos infinitos; esto da lo que de verdad va a
// pasar. En cada instante de decisión se recorren las tareas ELEGIBLES en
// orden de prioridad (derivado del grafo, ver `orden.ts`) y se les asigna
// capacidad. Determinista de punta a punta: misma entrada, misma salida.
//
// Modelo de recursos, y por qué no son cuadrillas enteras:
//
//  · La capacidad es un número REAL de cuadrillas-equivalente, `c^0.85`. Con
//    enteros no habría forma de que 2 cuadrillas rindan 1.80: o rinden 1
//    (redondeando abajo, y entonces duplicar el equipo no sirve de nada) o
//    rinden 2 (redondeando arriba, y entonces el rendimiento decreciente se
//    evapora). Una tarea puede correr a TASA fraccionaria: media cuadrilla
//    tarda el doble. Es la misma divisibilidad que ya suponía el motor
//    cuando repartía el trabajo de una fase entre `c_eff` cuadrillas.
//
//  · Ninguna tarea pasa de TASA 1: una tarea la hace una cuadrilla, y las
//    cuadrillas que sobran se van a OTRAS tareas o a otros espacios. Es lo
//    que garantiza D_SGS >= D_CPM (si una tarea pudiera acelerarse por
//    encima de su duración, el SGS podría bajar del suelo del CPM).
//
//  · Tope de congestión POR ESPACIO: en un espacio no caben más de
//    `capEspacio` cuadrillas a la vez (área ÷ a_min del oficio, nunca menos
//    de 1). Por eso un baño de 5 m² dura lo mismo con una cuadrilla que con
//    ocho, y un salón de 100 m² sí acelera.
//
//  · POOLS por gremio: el electricista y el plomero no son la misma persona.
//    Cada gremio tiene su propia capacidad, así que sus tareas se solapan
//    aunque la obra tenga una sola cuadrilla general.
//
// La asignación se REHACE en cada evento: cuando una tarea termina, su
// capacidad vuelve al bote y las que siguen abiertas pueden acelerar. Sin
// eso, una tarea que arrancó con media cuadrilla se quedaría a media
// cuadrilla toda la obra aunque el resto del equipo estuviera parado.
// ─────────────────────────────────────────────────────────────────────────

import { adyacencia } from "./orden";
import type { AristaCronograma, Grafo, NodoCronograma } from "./tipos";

export interface OpcionesSGS {
  /** Capacidad (cuadrillas-equivalente) de CADA pool de gremio. >= 1. */
  capacidad: number;
  /** Duración de cada nodo (escenario min/probable/max, con `f` aplicado). */
  duracion?: (n: NodoCronograma) => number;
  /** Lag de cada arista (permite apagar esperas de una en una). */
  lag?: (a: AristaCronograma) => number;
}

export interface ResultadoSGS {
  /** Duración de la obra con las cuadrillas dadas. */
  makespan: number;
  inicio: Map<string, number>;
  fin: Map<string, number>;
}

const EPS = 1e-9;

export function programarSerial(grafo: Grafo, opts: OpcionesSGS): ResultadoSGS {
  const dur = opts.duracion ?? ((n: NodoCronograma) => n.duracion);
  const lag = opts.lag ?? ((a: AristaCronograma) => a.lag);
  const capacidad = Math.max(1, opts.capacidad);
  const { salidas, entradas } = adyacencia(grafo.nodos, grafo.aristas);
  const porId = new Map(grafo.nodos.map((n) => [n.id, n]));

  const inicio = new Map<string, number>();
  const fin = new Map<string, number>();
  const restante = new Map<string, number>();
  // Predecesores que faltan por cerrar, e instante en que la tarea queda
  // LIBERADA (todos cerrados y todos los lags vencidos). Se mantienen al
  // vuelo, en vez de recalcularlos en cada ronda: el bucle se recorre tantas
  // veces como eventos hay, y esto lo deja en O(V+E) sobre todo el barrido.
  const faltan = new Map<string, number>();
  const liberada = new Map<string, number>();
  for (const n of grafo.nodos) {
    restante.set(n.id, Math.max(0, dur(n)));
    faltan.set(n.id, (entradas.get(n.id) ?? []).length);
    liberada.set(n.id, 0);
  }

  /** Cierra una tarea y libera a sus sucesores. */
  const cerrar = (id: string, instante: number): void => {
    fin.set(id, instante);
    for (const a of salidas.get(id) ?? []) {
      faltan.set(a.hasta, (faltan.get(a.hasta) ?? 1) - 1);
      liberada.set(a.hasta, Math.max(liberada.get(a.hasta) ?? 0, instante + lag(a)));
    }
  };

  const arrancadas = new Set<string>();
  let t = 0;
  let makespan = 0;
  const MAX_RONDAS = 4 * (grafo.nodos.length + grafo.aristas.length) + 100;

  for (let ronda = 0; ; ronda++) {
    if (ronda > MAX_RONDAS) {
      // Sale de aquí solo si el bucle deja de progresar, que sería un bug del
      // scheduler. Se grita en vez de devolver un cronograma a medias.
      throw new Error("cronograma: el SGS no converge (revisar lags o duraciones)");
    }

    // Tareas de duración cero: se cierran en el instante en que se liberan,
    // sin consumir cuadrilla. Se repite porque cerrar una puede liberar otra.
    let cerroAlguna = true;
    while (cerroAlguna) {
      cerroAlguna = false;
      for (const id of grafo.prioridad) {
        if (fin.has(id) || (restante.get(id) ?? 0) > EPS) continue;
        if ((faltan.get(id) ?? 0) > 0) continue;
        const libre = liberada.get(id) ?? 0;
        if (libre > t + EPS) continue;
        const instante = Math.max(t, libre);
        inicio.set(id, instante);
        cerrar(id, instante);
        makespan = Math.max(makespan, instante);
        cerroAlguna = true;
      }
    }

    // Reparto de capacidad entre las tareas abiertas y las recién liberadas,
    // en orden de prioridad.
    const usadoGremio = new Map<string, number>();
    const usadoEspacio = new Map<string, number>();
    const tasas: { id: string; tasa: number }[] = [];
    let siguienteLiberacion = Infinity;
    let quedaTrabajo = false;

    for (const id of grafo.prioridad) {
      if (fin.has(id)) continue;
      quedaTrabajo = true;
      if ((faltan.get(id) ?? 0) > 0) continue;
      const libre = liberada.get(id) ?? 0;
      if (libre > t + EPS) {
        siguienteLiberacion = Math.min(siguienteLiberacion, libre);
        continue;
      }
      const n = porId.get(id)!;
      const libreGremio = capacidad - (usadoGremio.get(n.gremio) ?? 0);
      const topeEspacio = Math.max(1, n.capEspacio);
      const libreEspacio = topeEspacio - (usadoEspacio.get(n.espacioId) ?? 0);
      const tasa = Math.min(1, libreGremio, libreEspacio);
      if (tasa <= EPS) continue;
      tasas.push({ id, tasa });
      usadoGremio.set(n.gremio, (usadoGremio.get(n.gremio) ?? 0) + tasa);
      usadoEspacio.set(n.espacioId, (usadoEspacio.get(n.espacioId) ?? 0) + tasa);
      if (!arrancadas.has(id)) {
        arrancadas.add(id);
        inicio.set(id, t);
      }
    }

    if (!quedaTrabajo) break;

    if (tasas.length === 0) {
      // Nadie puede trabajar: toda la obra está esperando a que algo seque.
      // Se salta al primer vencimiento. Es el único hueco que un lag puede
      // abrir en el calendario, y es exactamente lo que cuesta el fragüe.
      if (!Number.isFinite(siguienteLiberacion)) {
        throw new Error("cronograma: quedan tareas sin liberar y sin espera pendiente");
      }
      t = siguienteLiberacion;
      continue;
    }

    // Se avanza hasta el primer evento: o termina una tarea, o vence un lag
    // (que puede liberar una tarea de más prioridad y cambiar el reparto).
    let delta = Infinity;
    for (const { id, tasa } of tasas) delta = Math.min(delta, (restante.get(id) ?? 0) / tasa);
    if (Number.isFinite(siguienteLiberacion) && siguienteLiberacion - t > EPS) {
      delta = Math.min(delta, siguienteLiberacion - t);
    }
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new Error("cronograma: paso de tiempo no positivo en el SGS");
    }

    const instante = t + delta;
    for (const { id, tasa } of tasas) {
      const queda = (restante.get(id) ?? 0) - tasa * delta;
      if (queda <= EPS) {
        restante.set(id, 0);
        cerrar(id, instante);
        makespan = Math.max(makespan, instante);
      } else {
        restante.set(id, queda);
      }
    }
    t = instante;
  }

  return { makespan, inicio, fin };
}
