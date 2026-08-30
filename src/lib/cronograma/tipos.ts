// ─────────────────────────────────────────────────────────────────────────
// Tipos del CRONOGRAMA: grafo de precedencias, CPM y programación con
// recursos finitos. PURO Y SIN DOMINIO: aquí no se sabe qué es un estuco ni
// qué es un metro cuadrado. El motor de duración (`estimar-duracion.ts`)
// traduce la obra a estos nodos y aristas; este módulo solo programa.
//
// Un NODO es un par (espacio, tarea). Esa es la unidad, y no la fase: la
// precedencia constructiva es POR ESPACIO —se estuca el baño 1, se pasa al
// baño 2 y mientras el 1 fragua se puede pintar—, así que una fase no es una
// caja de tiempo, es una franja de la línea de balance.
// ─────────────────────────────────────────────────────────────────────────

/** Pool de recursos por defecto: la cuadrilla general de la obra. */
export const GREMIO_GENERAL = "general";

export interface NodoCronograma {
  /** Id único y determinista dentro del grafo. */
  id: string;
  /** Espacio al que pertenece (dos espacios pueden llamarse igual). */
  espacioId: string;
  /** Etiqueta legible (nombre de la tarea). */
  nombre: string;
  /** Fase constructiva, como texto libre para no atar el módulo al dominio. */
  fase: string;
  /** Posición constructiva de la fase (0 = la que abre la obra). */
  ordenFase: number;
  /** Trabajo de la tarea en días de UNA cuadrilla. Puede ser fraccionario. */
  duracion: number;
  /**
   * Pool de recursos que consume. Dos oficios distintos (electricista y
   * plomero) no compiten por la misma gente: van a pools distintos y por eso
   * se solapan aunque la obra tenga una sola cuadrilla general.
   */
  gremio: string;
  /**
   * Cuadrillas simultáneas que CABEN en el espacio (tope de congestión
   * físico: área ÷ a_min del oficio). Nunca por debajo de 1: en un baño de
   * 5 m² siempre cabe una cuadrilla, y nunca una segunda.
   */
  capEspacio: number;
}

/** Tipo de arista: de dónde sale la precedencia. */
export type TipoArista = "fase" | "explicita" | "secado";

export interface AristaCronograma {
  /** Id del nodo predecesor. */
  desde: string;
  /** Id del nodo sucesor. */
  hasta: string;
  /**
   * Retardo entre fin(desde) e inicio(hasta), en las MISMAS unidades que
   * `duracion` (días hábiles). Es el fragüe/secado: consume calendario, no
   * cuadrilla, así que nadie trabaja en esta tarea durante el lag pero la
   * cuadrilla sí puede irse a otra.
   */
  lag: number;
  tipo: TipoArista;
  /**
   * Etiqueta de la espera que originó el lag (`undefined` si lag = 0). Sirve
   * para encender/apagar esperas de una en una y atribuir a cada fase lo que
   * su secado aporta REALMENTE al makespan.
   */
  espera?: string;
}

export interface Grafo {
  nodos: NodoCronograma[];
  aristas: AristaCronograma[];
  /**
   * Aristas EXPLÍCITAS descartadas por cerrar un ciclo. No se lanza: un
   * `depende_de` mal puesto por el usuario no puede tumbar la estimación de
   * la obra entera. Se descarta la arista, se cuenta, y el resto del grafo
   * sigue en pie.
   */
  rechazadas: AristaCronograma[];
  /**
   * Orden de PRIORIDAD del scheduler, derivado del grafo y determinista:
   * nivel topológico ascendente (línea de balance: primero todos los
   * espacios en la fase k, luego todos en la k+1), desempate por camino
   * restante más largo, luego orden de fase, luego id.
   */
  prioridad: string[];
  /** Nivel topológico (longitud en nodos del camino más largo hasta él). */
  nivel: Map<string, number>;
  /** Camino restante más largo desde cada nodo hasta un sumidero. */
  caminoRestante: Map<string, number>;
}
