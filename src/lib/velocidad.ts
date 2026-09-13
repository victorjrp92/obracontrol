// ---------------------------------------------------------------------------
// VELOCIDAD de la obra: no cuanto se cerro, sino que tan rapido.
//
// El avance -"llevamos 53%"- se mide sumando trabajo aprobado, y para eso ya
// estan `calcularProgreso` y `avancePorFase`. Pero sumar trabajo NO dice si la
// gente rindio: una tarea de dos dias que tomo cinco sigue aportando sus dos
// dias al avance. Aqui se mide lo otro: lo que cada tarea TARDO contra lo que
// se acordo que tardara.
//
// == POR QUE SON DOS NUMEROS Y NO UNO =======================================
//
// `pctATiempo` dice CUANTAS incumplieron; `diasDeMas` dice POR CUANTO. Con
// diez tareas de dos dias: cinco que se pasan a 2,2 dias y cinco que se pasan
// a 6 dan el MISMO 50% a tiempo, y son obras distintas. La primera es un roce;
// la segunda, un desastre. Y al reves, 90% a tiempo con una sola tarea de 12
// dias esconde un problema grave detras de un numero que se ve bien.
//
// Juntos separan dos diagnosticos opuestos: muchos incumplimientos pequenos
// (rotacion, clima, desmotivacion) contra pocos enormes (algo se trabo).
//
// == LO QUE ESTE MODULO NO PUEDE ARREGLAR ===================================
//
// "Cuanto tardo" sale de `fecha_inicio` a `fecha_fin_real`, y hoy
// `fecha_inicio` se rellena al REPORTAR, no al empezar: incluye la espera.
// Mientras no exista una marca de inicio de verdad, esto mide "desde que debia
// arrancar hasta que se aprobo", que es una cota superior del tiempo de
// trabajo. Sirve para comparar periodos entre si -el sesgo es el mismo en
// todos- pero no para afirmar "esta tarea tomo tres dias de mano de obra". La
// interfaz tiene que decirlo, no esconderlo.
//
// Puro y sin Prisma: recibe las tareas ya cargadas por la pagina.
// ---------------------------------------------------------------------------

import {
  DIAS_HABILES_SEMANA_DEFECTO,
  diasHabilesFraccionarios,
} from "@/lib/calendario-colombia";

/**
 * Un dia de CALENDARIO, en milisegundos.
 *
 * Se usa solo para agrupar en cubos -a que semana pertenece una fecha-, que es
 * aritmetica de calendario: la semana del 9 de marzo es la misma se trabaje el
 * domingo o no. Para MEDIR cuanto tardo una tarea NO se usa esto: eso va en
 * dias habiles, con `diasHabilesEntre`. Mezclar las dos cosas es exactamente
 * el error que este modulo acaba de corregir.
 */
const DIA = 86_400_000;

/** Lo minimo de una tarea para poder medirle velocidad. */
export interface TareaVelocidad {
  estado: string;
  tiempo_acordado_dias: number;
  fecha_inicio: Date | null;
  fecha_fin_real: Date | null;
  fase: string;
  faseOrden: number;
  /** Id de la unidad: el ciclo se mide por apartamento, no por tarea. */
  unidadId: string;
  torre: string;
  piso: string;
  tipologia: string;
  responsable: string;
}

export type Periodo = "sem" | "qui" | "mes" | "tri" | "sms" | "ano";

export const PERIODOS: { clave: Periodo; nombre: string }[] = [
  { clave: "sem", nombre: "Semana" },
  { clave: "qui", nombre: "Quincena" },
  { clave: "mes", nombre: "Mes" },
  { clave: "tri", nombre: "Trimestre" },
  { clave: "sms", nombre: "Semestre" },
  { clave: "ano", nombre: "Año" },
];

export interface PuntoVelocidad {
  /** Entero creciente: ordena sin depender del texto de la etiqueta. */
  orden: number;
  etiqueta: string;
  cerradas: number;
  aTiempo: number;
  /** 0-100. */
  pctATiempo: number;
  /** Promedio de (real menos acordado). Negativo = terminaron antes. */
  diasDeMas: number;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** La tarea se puede medir: cerrada, con las dos fechas y un plazo valido. */
export function medible(t: TareaVelocidad): boolean {
  return (
    t.estado === "APROBADA" &&
    t.fecha_inicio instanceof Date &&
    t.fecha_fin_real instanceof Date &&
    Number.isFinite(t.fecha_inicio.getTime()) &&
    Number.isFinite(t.fecha_fin_real.getTime()) &&
    t.fecha_fin_real.getTime() >= t.fecha_inicio.getTime() &&
    Number.isFinite(t.tiempo_acordado_dias) &&
    t.tiempo_acordado_dias > 0
  );
}

/**
 * Dias HABILES que tardo de verdad. Minimo medio dia.
 *
 * Habiles y no calendario porque `tiempo_acordado_dias` -contra lo que se
 * compara- son dias de trabajo: nadie acuerda una tarea de dos dias contando
 * el domingo. Esto no es una preferencia, es una CORRECCION: hasta ahora este
 * modulo media en calendario mientras `scoring.ts` medía el MISMO campo en
 * habiles, asi que el semaforo de la lista de Tareas y la grafica de Reportes
 * le daban al mismo usuario dos verdades distintas sobre la misma tarea. Con
 * los 18 festivos colombianos mas los domingos, la diferencia llega al 30%.
 *
 * == POR QUE LA VERSION FRACCIONARIA Y NO LA DE SCORING ====================
 *
 * El repo tiene dos `diasHabilesEntre`. La de `calendario-colombia` devuelve
 * dias ENTEROS y es la que usa el semaforo, que solo necesita decidir
 * cumplio/no cumplio. Aqui se usa la de `duraciones-mercado`, que devuelve
 * FRACCIONES, porque este modulo no decide: MIDE POR CUANTO. Con dias enteros,
 * cinco tareas de dos dias que se van a 2,2 se redondean a 2 y salen "a
 * tiempo" — y distinguir ese roce de un desastre de cuatro dias es la razon
 * entera de que esta metrica exista aparte del porcentaje.
 *
 * Las dos descuentan los mismos domingos y los mismos 18 festivos, asi que el
 * semaforo y esta grafica ya no se contradicen: solo redondean distinto, cada
 * una segun lo que tiene que contestar.
 */
export function diasReales(
  t: TareaVelocidad,
  diasHabilesSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): number {
  const d = diasHabilesFraccionarios(t.fecha_inicio!, t.fecha_fin_real!, diasHabilesSemana);
  return Math.max(0.5, d);
}

function cubo(f: Date, p: Periodo): { orden: number; etiqueta: string } {
  const y = f.getUTCFullYear();
  const m = f.getUTCMonth();
  const d = f.getUTCDate();
  if (p === "ano") return { orden: y, etiqueta: String(y) };
  if (p === "sms") {
    const s = Math.floor(m / 6);
    return { orden: y * 2 + s, etiqueta: `S${s + 1}` };
  }
  if (p === "mes") return { orden: y * 12 + m, etiqueta: MESES[m] };
  if (p === "tri") {
    const q = Math.floor(m / 3);
    return { orden: y * 4 + q, etiqueta: `T${q + 1}` };
  }
  if (p === "qui") {
    const q = d <= 15 ? 0 : 1;
    return { orden: (y * 12 + m) * 2 + q, etiqueta: `${MESES[m]} ${q === 0 ? "1a" : "2a"}` };
  }
  // Semana: se ancla al lunes para que dos fechas de la misma semana caigan en
  // el mismo cubo sin importar el dia.
  const lunes = new Date(Date.UTC(y, m, d));
  lunes.setUTCDate(lunes.getUTCDate() - ((lunes.getUTCDay() + 6) % 7));
  return {
    orden: Math.floor(lunes.getTime() / (7 * DIA)),
    etiqueta: `${lunes.getUTCDate()} ${MESES[lunes.getUTCMonth()]}`,
  };
}

/**
 * Serie temporal de las dos metricas, agrupada por el periodo pedido.
 *
 * Se agrupa por `fecha_fin_real` -cuando se cerro- y no por el arranque: la
 * pregunta es "este mes como rindieron", y el mes de una tarea es el mes en
 * que quedo terminada.
 */
export function serieVelocidad(
  tareas: TareaVelocidad[],
  periodo: Periodo,
  /** Jornada del proyecto (`Proyecto.dias_habiles_semana`). */
  diasHabilesSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): PuntoVelocidad[] {
  const mapa = new Map<number, PuntoVelocidad & { suma: number }>();
  for (const t of tareas) {
    if (!medible(t)) continue;
    const { orden, etiqueta } = cubo(t.fecha_fin_real!, periodo);
    const p = mapa.get(orden) ?? {
      orden,
      etiqueta,
      cerradas: 0,
      aTiempo: 0,
      pctATiempo: 0,
      diasDeMas: 0,
      suma: 0,
    };
    p.cerradas++;
    const exceso = diasReales(t, diasHabilesSemana) - t.tiempo_acordado_dias;
    // Tolerancia de una centesima: una tarea que cierra exactamente en su
    // plazo no puede contar como incumplida por un error de coma flotante.
    if (exceso <= 0.01) p.aTiempo++;
    p.suma += exceso;
    mapa.set(orden, p);
  }
  return [...mapa.values()]
    .sort((a, b) => a.orden - b.orden)
    .map(({ suma, ...p }) => ({
      ...p,
      pctATiempo: p.cerradas > 0 ? Math.round((p.aTiempo / p.cerradas) * 100) : 0,
      diasDeMas: p.cerradas > 0 ? suma / p.cerradas : 0,
    }));
}

/** Minimo de cubos para que una serie cuente algo: con menos de tres no hay
 *  tendencia que leer, solo dos puntos y una raya entre ellos. */
export const MINIMO_CUBOS = 3;

/**
 * Que periodos vale la pena ofrecer en el selector.
 *
 * Una obra de ocho meses no tiene un semestre anterior contra el cual
 * compararse, y enseñar esa opcion produce una grafica de dos puntos que
 * parece rota. Mejor deshabilitarla que dejar que el usuario la elija y se
 * encuentre con eso.
 */
export function periodosDisponibles(tareas: TareaVelocidad[]): Set<Periodo> {
  return new Set(
    PERIODOS.filter((p) => serieVelocidad(tareas, p.clave).length >= MINIMO_CUBOS).map(
      (p) => p.clave,
    ),
  );
}

// --- Matriz de ciclo -------------------------------------------------------

export type Dimension = "torre" | "piso" | "tipologia" | "responsable";

export const DIMENSIONES: { clave: Dimension; nombre: string }[] = [
  { clave: "torre", nombre: "Torre" },
  { clave: "piso", nombre: "Piso" },
  { clave: "tipologia", nombre: "Tipologia" },
  { clave: "responsable", nombre: "Responsable" },
];

export interface CeldaCiclo {
  /** Dias promedio que tarda la fase en una unidad. `null` = sin datos. */
  dias: number | null;
  /** Cuantas unidades cerraron la fase. Con pocas, el promedio no vale. */
  unidades: number;
}

export interface MatrizCiclo {
  fases: string[];
  columnas: string[];
  /** Se lee `celdas.get(fase)?.get(columna)`. */
  celdas: Map<string, Map<string, CeldaCiclo>>;
  minDias: number;
  maxDias: number;
}

/** Tope de columnas: mas alla de esto la matriz deja de leerse. */
export const MAX_COLUMNAS = 8;

/**
 * Separador de la clave compuesta. Se usa un caracter que no puede aparecer en
 * el nombre de una torre, un piso ni una persona: con un espacio, "Torre 1" en
 * la fase "Aseo" colisionaria con "Torre" en la fase "Aseo 1".
 */
const SEP = "\u0000";

/**
 * Dias de ciclo por unidad, cruzando fase contra la dimension pedida.
 *
 * El ciclo de una fase en un apartamento va desde que arranca su PRIMERA tarea
 * hasta que cierra la ULTIMA: es el tiempo que esa fase ocupo ese espacio, que
 * es lo que un residente entiende por "cuanto se demoraron enchapando el 301".
 *
 * Solo entran unidades que CERRARON la fase entera. Eso trae un sesgo que la
 * interfaz debe advertir: una torre a medio camino solo aporta los
 * apartamentos que alcanzo a terminar -casi siempre los mas faciles- y se ve
 * mas rapida de lo que es. Por eso cada celda devuelve cuantas unidades la
 * respaldan.
 */
export function matrizCiclo(
  tareas: TareaVelocidad[],
  dimension: Dimension,
  /** Jornada del proyecto (`Proyecto.dias_habiles_semana`). */
  diasHabilesSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): MatrizCiclo {
  const acc = new Map<string, { ini: number; fin: number; cerradas: number; total: number }>();
  const ordenFase = new Map<string, number>();

  for (const t of tareas) {
    const col = t[dimension];
    if (!col) continue;
    ordenFase.set(t.fase, t.faseOrden);
    const k = t.fase + SEP + col + SEP + t.unidadId;
    const a = acc.get(k) ?? { ini: Infinity, fin: -Infinity, cerradas: 0, total: 0 };
    a.total++;
    if (medible(t)) {
      a.cerradas++;
      a.ini = Math.min(a.ini, t.fecha_inicio!.getTime());
      a.fin = Math.max(a.fin, t.fecha_fin_real!.getTime());
    }
    acc.set(k, a);
  }

  const porCelda = new Map<string, { suma: number; n: number }>();
  for (const [k, a] of acc) {
    // La unidad cuenta solo si cerro TODAS las tareas de esa fase: un
    // apartamento a medio enchapar no tiene un "ciclo de enchape".
    if (a.cerradas === 0 || a.cerradas < a.total) continue;
    const partes = k.split(SEP);
    const ck = partes[0] + SEP + partes[1];
    const c = porCelda.get(ck) ?? { suma: 0, n: 0 };
    // Habiles, igual que `diasReales`: si la matriz contara calendario y la
    // grafica de arriba habiles, la misma obra tendria dos duraciones en la
    // misma pantalla.
    c.suma += Math.max(0.5, diasHabilesFraccionarios(new Date(a.ini), new Date(a.fin), diasHabilesSemana));
    c.n++;
    porCelda.set(ck, c);
  }

  const fases = [...ordenFase.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([f]) => f);

  const cols = [...new Set(tareas.map((t) => t[dimension]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .slice(0, MAX_COLUMNAS);

  const celdas = new Map<string, Map<string, CeldaCiclo>>();
  let minDias = Infinity;
  let maxDias = -Infinity;
  for (const f of fases) {
    const fila = new Map<string, CeldaCiclo>();
    for (const c of cols) {
      const v = porCelda.get(f + SEP + c);
      if (v && v.n > 0) {
        const dias = v.suma / v.n;
        fila.set(c, { dias, unidades: v.n });
        minDias = Math.min(minDias, dias);
        maxDias = Math.max(maxDias, dias);
      } else {
        fila.set(c, { dias: null, unidades: 0 });
      }
    }
    celdas.set(f, fila);
  }

  // Una fase sin datos en ninguna columna solo aportaria una fila vacia.
  const conDatos = fases.filter((f) => [...celdas.get(f)!.values()].some((c) => c.dias !== null));

  return {
    fases: conDatos,
    columnas: cols,
    celdas,
    minDias: Number.isFinite(minDias) ? minDias : 0,
    maxDias: Number.isFinite(maxDias) ? maxDias : 0,
  };
}
