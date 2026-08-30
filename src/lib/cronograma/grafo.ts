// ─────────────────────────────────────────────────────────────────────────
// Construcción del GRAFO de precedencias de la obra.
//
// Aristas, en el orden en que se insertan:
//
//  · E_fase   — DENTRO de cada espacio, del nivel constructivo k al k+1.
//    Es el cambio central de esta fase: antes la precedencia era GLOBAL (no
//    empezaba la pintura de ningún espacio hasta que TODOS estaban estucados)
//    y ahora es por espacio, que es como se construye de verdad. Nunca
//    produce ciclos: toda arista va de un `ordenFase` menor a uno mayor
//    dentro del mismo espacio.
//    Dos fases con el MISMO `ordenFase` en un espacio son simultáneas
//    (oficios distintos: eléctricas y hidrosanitarias) y no se preceden.
//
//  · E_secado — las esperas de fragüe/secado, como LAG de arista. Vienen ya
//    resueltas por el llamador porque son dominio puro: el fragüe de pañete
//    va de la tarea de pañete a la de estuco DEL MISMO espacio, y el de la
//    placa va de TODAS las placas a todo lo que se cargue encima, en toda la
//    obra (la losa es una sola).
//
//  · E_expl   — las de `Tarea.depende_de`. Es la única fuente que puede
//    cerrar un ciclo, porque la escribe (y la edita) el usuario. Se rechaza
//    la arista, no la obra: la estimación sigue en pie sin ella.
//
// Todo el módulo es PURO: mismas entradas dan mismas salidas, sin reloj, sin
// azar y sin dominio.
// ─────────────────────────────────────────────────────────────────────────

import {
  adyacencia,
  alcanzable,
  caminosRestantes,
  niveles,
  ordenPrioridad,
  ordenTopologico,
} from "./orden";
import type { AristaCronograma, Grafo, NodoCronograma } from "./tipos";

export interface EntradaNodo extends NodoCronograma {
  /**
   * Espera (días HÁBILES) que hay que aguantar antes de ESTA tarea, sobre las
   * aristas de fase que entran en ella. Es el secado de la fase que la
   * precede: el estuco tiene que fraguar antes de que se pinte encima.
   */
  lagEntrada?: number;
  /** Etiqueta de la espera de `lagEntrada` (para encenderlas de una en una). */
  esperaEntrada?: string;
}

export interface EntradaGrafo {
  nodos: EntradaNodo[];
  /**
   * Aristas de secado que NO son «entre niveles de un espacio»: el fragüe de
   * pañete (dentro de la misma fase) y el de la placa (entre espacios).
   */
  extra?: AristaCronograma[];
  /** Aristas explícitas del usuario (`depende_de`), por id de nodo. */
  explicitas?: { desde: string; hasta: string }[];
}

/** Clave canónica de una arista, para deduplicar. */
function clave(desde: string, hasta: string): string {
  return `${desde} ${hasta}`;
}

export function construirGrafo(entrada: EntradaGrafo): Grafo {
  const nodos: NodoCronograma[] = entrada.nodos.map((n) => ({
    id: n.id,
    espacioId: n.espacioId,
    nombre: n.nombre,
    fase: n.fase,
    ordenFase: n.ordenFase,
    duracion: n.duracion,
    gremio: n.gremio,
    capEspacio: n.capEspacio,
  }));
  const porId = new Map(entrada.nodos.map((n) => [n.id, n]));

  const aristas: AristaCronograma[] = [];
  const rechazadas: AristaCronograma[] = [];
  const indice = new Map<string, AristaCronograma>();
  const salidas = new Map<string, AristaCronograma[]>();
  for (const n of nodos) salidas.set(n.id, []);

  /** Inserta deduplicando: si ya existe la arista, gana el lag mayor. */
  const insertar = (a: AristaCronograma): void => {
    const k = clave(a.desde, a.hasta);
    const previa = indice.get(k);
    if (previa) {
      if (a.lag > previa.lag) {
        previa.lag = a.lag;
        previa.espera = a.espera;
      }
      return;
    }
    indice.set(k, a);
    aristas.push(a);
    salidas.get(a.desde)?.push(a);
  };

  /**
   * Inserta solo si no cierra un ciclo. Devuelve false y anota la arista en
   * `rechazadas` si `desde` ya es alcanzable desde `hasta`.
   */
  const insertarSeguro = (a: AristaCronograma): boolean => {
    if (!porId.has(a.desde) || !porId.has(a.hasta)) return false;
    if (a.desde === a.hasta || alcanzable(a.hasta, a.desde, salidas)) {
      rechazadas.push(a);
      return false;
    }
    insertar(a);
    return true;
  };

  // ── E_fase: niveles constructivos DENTRO de cada espacio ─────────────────
  const porEspacio = new Map<string, EntradaNodo[]>();
  for (const n of entrada.nodos) {
    const lista = porEspacio.get(n.espacioId);
    if (lista) lista.push(n);
    else porEspacio.set(n.espacioId, [n]);
  }
  for (const lista of porEspacio.values()) {
    const porNivel = new Map<number, EntradaNodo[]>();
    for (const n of lista) {
      const g = porNivel.get(n.ordenFase);
      if (g) g.push(n);
      else porNivel.set(n.ordenFase, [n]);
    }
    const ordenes = [...porNivel.keys()].sort((a, b) => a - b);
    for (let i = 1; i < ordenes.length; i++) {
      const previos = porNivel.get(ordenes[i - 1])!;
      const actuales = porNivel.get(ordenes[i])!;
      for (const u of previos) {
        for (const v of actuales) {
          const lag = v.lagEntrada && v.lagEntrada > 0 ? v.lagEntrada : 0;
          insertar({
            desde: u.id,
            hasta: v.id,
            lag,
            tipo: lag > 0 ? "secado" : "fase",
            ...(lag > 0 && v.esperaEntrada ? { espera: v.esperaEntrada } : {}),
          });
        }
      }
    }
  }

  // ── E_secado que no encaja en «entre niveles»: pañete a estuco, y placa ──
  for (const a of entrada.extra ?? []) insertarSeguro({ ...a });

  // ── E_expl: `depende_de`. Lo único que puede cerrar un ciclo ─────────────
  for (const e of entrada.explicitas ?? []) {
    insertarSeguro({ desde: e.desde, hasta: e.hasta, lag: 0, tipo: "explicita" });
  }

  const orden = ordenTopologico(nodos, aristas);
  if (!orden) {
    // No puede ocurrir: E_fase es acíclica por construcción y las otras dos
    // fuentes pasan por `insertarSeguro`. Si ocurre, es un bug del módulo y
    // se grita en vez de devolver un cronograma inventado.
    throw new Error("cronograma: el grafo quedó con un ciclo pese al guardián de aristas");
  }
  const { entradas, salidas: sal } = adyacencia(nodos, aristas);
  const nivel = niveles(orden, entradas);
  const caminoRestante = caminosRestantes(orden, new Map(nodos.map((n) => [n.id, n])), sal);

  return {
    nodos,
    aristas,
    rechazadas,
    prioridad: ordenPrioridad(nodos, nivel, caminoRestante),
    nivel,
    caminoRestante,
  };
}
