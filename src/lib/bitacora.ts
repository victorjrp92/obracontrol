// ---------------------------------------------------------------------------
// LA BITACORA DE OBRA: quien hizo que, cuando, y quien lo aprobo o lo devolvio.
//
// La tabla `Aprobacion` es append-only —una fila por decision firmada, nadie la
// edita ni la borra— y hasta hoy solo se leia en el PDF que el CONTRATISTA se
// baja de SI MISMO. O sea: el unico que veia el historial de decisiones era el
// juzgado, no el juez. Este modulo es la aritmetica de la pantalla que le falta
// al director de obra.
//
// == POR QUE LA LATENCIA SE MIDE COMO SE MIDE ===============================
//
// «Cuanto tarda en revisar» deberia ser `fecha_de_reporte -> Aprobacion.fecha`,
// pero NO EXISTE columna «fecha de reporte». `updated_at` no sirve: cualquier
// edicion posterior de la tarea la pisa. Lo mas cercano y honesto es
// `Tarea.fecha_inicio`, que se rellena al reportar y solo la primera vez
// (`api/tareas/[id]/reportar/route.ts`: `fecha_inicio: tarea.fecha_inicio ?? new Date()`).
//
// De ahi salen dos reglas que este modulo aplica y la pantalla declara:
//
//   1. Solo se mide la PRIMERA decision de cada tarea. Como `fecha_inicio` se
//      congela en el primer reporte, la latencia del segundo intento incluiria
//      todo lo que el contratista tardo en rehacer el trabajo, que no es
//      tiempo de revision de nadie. Medir los reintentos con esa marca no seria
//      un numero impreciso: seria un numero que culpa al revisor del retraso
//      del ejecutor.
//   2. Una decision firmada ANTES de su propio reporte no se mide. Es dato
//      incoherente (import, migracion, seed), y colarla como latencia negativa
//      arrastraria la media de esa persona hacia abajo sin que se note.
//
// Lo que no se puede medir se CUENTA aparte (`medibles` sobre `total`) en vez
// de desaparecer: un reporte que no dice sobre cuantos casos mide no es un
// reporte, es una opinion.
//
// == POR QUE MEDIANA Y MEDIA, Y NO SOLO LA MEDIA ============================
//
// El dueno pidio «cuanto tarda de media». Con 228 dias de historia, una sola
// tarea reportada en marzo y aprobada en septiembre mueve la media de un
// revisor de 4 horas a 12 dias, y el director acusa al que si trabaja. La
// mediana aguanta ese tiron. Se devuelven las dos a proposito: cuando la media
// es mucho mayor que la mediana, eso NO es ruido, es el hallazgo — hay una cola
// de tareas olvidadas en la bandeja.
//
// Modulo PURO: sin Prisma, sin React y sin `new Date()` implicito (el instante
// entra siempre por parametro). Por eso `scripts/verificar-bitacora.ts` puede
// probarlo entero sin tocar la base.
// ---------------------------------------------------------------------------

/** Las dos unicas decisiones que existen (espejo de `EstadoAprobacion`). */
export type EstadoDecision = "APROBADA" | "NO_APROBADA";

const HORA_MS = 3_600_000;
const DIA_HORAS = 24;

/**
 * Cuantas decisiones entran en una pagina de la bitacora.
 *
 * Vive en el modulo puro -y no junto a la consulta- porque la pantalla la
 * necesita para numerar («51-100 de 2.399») y la consulta para paginar. Si cada
 * una tuviera la suya, la ultima pagina mostraria un rango que no es el suyo y
 * nadie lo notaria hasta contar a mano.
 */
export const SUCESOS_POR_PAGINA = 50;

// ─── Resumen por persona ─────────────────────────────────────────────────────

/** Una decision firmada, reducida a lo que necesita el resumen. */
export interface DecisionResumen {
  /** `Aprobacion.id`. Identifica la fila: es lo que permite decir cual es la primera. */
  decisionId: string;
  tareaId: string;
  aprobadorId: string;
  aprobadorNombre: string;
  estado: EstadoDecision;
  /** `Aprobacion.fecha`: cuando se firmo. */
  fechaDecision: Date;
  /** `Tarea.fecha_inicio`, que es el proxy del reporte. `null` si nunca se relleno. */
  fechaReporte: Date | null;
}

/** Alguien que PUEDE aprobar en esta obra, tenga o no decisiones en el periodo. */
export interface PersonaEsperada {
  id: string;
  nombre: string;
}

export interface FilaPersona {
  aprobadorId: string;
  nombre: string;
  aprobadas: number;
  devueltas: number;
  total: number;
  /** Porcentaje de devoluciones sobre SUS decisiones, 0 si no decidio nada. */
  pctDevueltas: number;
  /** Mediana de horas entre reporte y decision. `null` si no hay ni un caso medible. */
  horasMediana: number | null;
  /** Media de las mismas horas. Junto a la mediana delata la cola de olvidadas. */
  horasMedia: number | null;
  /** Sobre cuantas decisiones suyas se pudo medir el tiempo. */
  medibles: number;
}

export interface ResumenBitacora {
  decisiones: number;
  devoluciones: number;
  /** Porcentaje de devoluciones sobre el total del periodo. */
  pctDevoluciones: number;
  personas: FilaPersona[];
}

/**
 * Horas entre el reporte y la decision, o `null` si no es medible.
 *
 * Devuelve `null` -y no 0, ni un numero negativo- en los dos casos en los que
 * el dato no da para afirmar nada: sin marca de reporte, y con una decision
 * anterior a su propio reporte.
 */
export function horasRevision(fechaReporte: Date | null, fechaDecision: Date): number | null {
  if (!fechaReporte) return null;
  const ms = fechaDecision.getTime() - fechaReporte.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / HORA_MS;
}

/**
 * Los ids de las decisiones que son la PRIMERA de su tarea.
 *
 * El desempate por `decisionId` no es cosmetico: dos aprobaciones con la misma
 * fecha exacta (import masivo) tienen que resolverse igual en cada render, o la
 * misma pantalla recargada mediria la latencia de una persona distinta.
 */
export function idsPrimeraDecisionPorTarea(filas: DecisionResumen[]): Set<string> {
  const primera = new Map<string, DecisionResumen>();
  for (const f of filas) {
    const actual = primera.get(f.tareaId);
    if (!actual) {
      primera.set(f.tareaId, f);
      continue;
    }
    const t = f.fechaDecision.getTime();
    const tActual = actual.fechaDecision.getTime();
    if (t < tActual || (t === tActual && f.decisionId < actual.decisionId)) {
      primera.set(f.tareaId, f);
    }
  }
  return new Set([...primera.values()].map((f) => f.decisionId));
}

/** Mediana de una lista de numeros. `null` si esta vacia. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/** Media aritmetica. `null` si la lista esta vacia. */
export function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

/**
 * Una fila por persona: cuantas aprobo, cuantas devolvio y cuanto tarda.
 *
 * `personasEsperadas` son los que PUEDEN aprobar en la obra. Entran con ceros
 * aunque no tengan ni una decision, porque la pregunta del dueno -«si no se
 * esta aprobando hay alguien que no esta haciendo su trabajo»- solo se contesta
 * si el que no aparece TAMBIEN aparece. Una tabla construida solo con quien
 * firmo es una tabla de la que el ausente se cae, que es justo al que se busca.
 */
export function resumirPorPersona(
  filas: DecisionResumen[],
  personasEsperadas: PersonaEsperada[] = [],
  /**
   * Ids de la PRIMERA decision de cada tarea, calculados sobre la historia
   * COMPLETA de la obra y no sobre `filas`.
   *
   * Sin esto el numero miente en cuanto alguien filtra. Si el filtro -por
   * persona, por «desde» o por «hasta»- deja fuera la decision 1 de una tarea,
   * la decision 2 asciende a «primera» y se mide contra `fecha_inicio`, que
   * sigue congelada en el PRIMER reporte. Resultado: al revisor que aprobo un
   * reintento se le carga el tiempo que el contratista tardo en rehacer el
   * trabajo. Se vio en una prueba real: la misma persona salia «—» sin filtro y
   * «172 dias» con filtro, en la misma pantalla y a dos centimetros de una fila
   * que decia que el dato no era medible.
   *
   * Opcional para que los casos de prueba puedan seguir pasando solo `filas`
   * cuando el conjunto YA es la historia entera.
   */
  primerasDelHistorial?: Set<string>,
): FilaPersona[] {
  interface Acumulado {
    nombre: string;
    aprobadas: number;
    devueltas: number;
    latencias: number[];
  }

  const acc = new Map<string, Acumulado>();
  for (const p of personasEsperadas) {
    acc.set(p.id, { nombre: p.nombre, aprobadas: 0, devueltas: 0, latencias: [] });
  }

  const primeras = primerasDelHistorial ?? idsPrimeraDecisionPorTarea(filas);

  for (const f of filas) {
    let fila = acc.get(f.aprobadorId);
    if (!fila) {
      fila = { nombre: f.aprobadorNombre, aprobadas: 0, devueltas: 0, latencias: [] };
      acc.set(f.aprobadorId, fila);
    }
    if (f.estado === "NO_APROBADA") fila.devueltas++;
    else fila.aprobadas++;

    if (primeras.has(f.decisionId)) {
      const h = horasRevision(f.fechaReporte, f.fechaDecision);
      if (h !== null) fila.latencias.push(h);
    }
  }

  return [...acc.entries()]
    .map(([aprobadorId, a]) => {
      const total = a.aprobadas + a.devueltas;
      return {
        aprobadorId,
        nombre: a.nombre,
        aprobadas: a.aprobadas,
        devueltas: a.devueltas,
        total,
        pctDevueltas: total > 0 ? (a.devueltas / total) * 100 : 0,
        horasMediana: mediana(a.latencias),
        horasMedia: media(a.latencias),
        medibles: a.latencias.length,
      };
    })
    // Primero quien mas decide; el que no decidio nada cae al final, que es
    // donde el director lo busca. Desempate por nombre para que el orden no
    // baile entre recargas.
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
}

/** El resumen completo del periodo: los dos totales y la tabla de personas. */
export function resumenBitacora(
  filas: DecisionResumen[],
  personasEsperadas: PersonaEsperada[] = [],
  primerasDelHistorial?: Set<string>,
): ResumenBitacora {
  const devoluciones = filas.reduce((n, f) => n + (f.estado === "NO_APROBADA" ? 1 : 0), 0);
  return {
    decisiones: filas.length,
    devoluciones,
    pctDevoluciones: filas.length > 0 ? (devoluciones / filas.length) * 100 : 0,
    personas: resumirPorPersona(filas, personasEsperadas, primerasDelHistorial),
  };
}

// ─── Secuencia de intentos ───────────────────────────────────────────────────

export interface DecisionIntento {
  decisionId: string;
  tareaId: string;
  fechaDecision: Date;
}

export interface Intento {
  /** 1 = primera vez que se decidio sobre esta tarea. */
  intento: number;
  /** Cuantas decisiones acumula la tarea en total. */
  total: number;
}

/**
 * Numera las decisiones de cada tarea: «intento 2 de 3».
 *
 * Se numera sobre TODAS las decisiones de la tarea, no sobre las que caben en
 * la pagina ni sobre las que sobreviven al filtro. Si no, filtrar por «solo
 * devoluciones» renumeraria la secuencia y la segunda devolucion de una tarea
 * aparecerian como el primer intento — mentira con formato de dato.
 */
export function numerarIntentos(decisiones: DecisionIntento[]): Map<string, Intento> {
  const porTarea = new Map<string, DecisionIntento[]>();
  for (const d of decisiones) {
    const lista = porTarea.get(d.tareaId);
    if (lista) lista.push(d);
    else porTarea.set(d.tareaId, [d]);
  }

  const salida = new Map<string, Intento>();
  for (const lista of porTarea.values()) {
    const orden = [...lista].sort(
      (a, b) =>
        a.fechaDecision.getTime() - b.fechaDecision.getTime() ||
        a.decisionId.localeCompare(b.decisionId),
    );
    orden.forEach((d, i) => salida.set(d.decisionId, { intento: i + 1, total: orden.length }));
  }
  return salida;
}

// ─── Quien puso la mano ──────────────────────────────────────────────────────

export type FuenteReportador = "evidencia" | "asignado";

/** Autor de una evidencia: puede ser un usuario del sistema o un obrero con token. */
export interface EvidenciaAutor {
  nombre: string;
  timestamp: Date;
}

/**
 * Quien tomo la evidencia que sostiene ESTA decision.
 *
 * Es la ultima evidencia anterior a la firma, no la ultima de la tarea: si el
 * contratista rehizo el trabajo y subio otra foto despues, esa foto pertenece
 * al intento siguiente y atribuirsela a la decision ya firmada seria reescribir
 * la historia. Si no hay ninguna evidencia anterior a la firma devuelve `null`
 * y el que llama cae a `Tarea.asignado_a`, que es quien RESPONDE por la tarea
 * aunque no sea quien puso la mano.
 */
export function autorDeEvidencia(
  evidencias: EvidenciaAutor[],
  fechaDecision: Date,
): EvidenciaAutor | null {
  let elegida: EvidenciaAutor | null = null;
  for (const e of evidencias) {
    if (e.timestamp.getTime() > fechaDecision.getTime()) continue;
    if (!elegida || e.timestamp.getTime() > elegida.timestamp.getTime()) elegida = e;
  }
  return elegida;
}

// ─── La linea de la bitacora ─────────────────────────────────────────────────

/** Un suceso: una decision con todo su contexto, tal como se pinta. */
export interface SucesoBitacora {
  decisionId: string;
  tareaId: string;
  tareaNombre: string;
  numeroRegistro: string | null;
  fase: string;
  espacio: string;
  unidad: string;
  piso: number;
  torre: string;
  estado: EstadoDecision;
  fechaDecision: Date;
  aprobador: string;
  /** Motivo del rechazo (`justificacion_por_item.motivo`). `null` si aprobo o si no lo escribio. */
  motivo: string | null;
  reportadoPor: string | null;
  reportadoPorFuente: FuenteReportador | null;
  fechaReporte: Date | null;
  horasRevision: number | null;
  notaReporte: string | null;
  intento: number;
  intentosTotales: number;
}

/**
 * Orden cronologico inverso: lo ultimo, arriba.
 *
 * Copia antes de ordenar -`sort` muta- y desempata por id descendente para que
 * dos decisiones del mismo segundo no se intercambien entre renders.
 */
export function ordenarSucesos<T extends { fechaDecision: Date; decisionId: string }>(
  sucesos: T[],
): T[] {
  return [...sucesos].sort(
    (a, b) =>
      b.fechaDecision.getTime() - a.fechaDecision.getTime() ||
      b.decisionId.localeCompare(a.decisionId),
  );
}

/**
 * Normaliza el motivo de un rechazo.
 *
 * `extractMotivo` devuelve tal cual lo que haya en `justificacion_por_item`, y
 * ahi caben la cadena vacia y los espacios en blanco: la interfaz de aprobacion
 * exige texto, pero los 2.399 registros de produccion no nacieron todos de esa
 * interfaz. Una cadena vacia NO la atrapa un `??` -solo `null` y `undefined`-,
 * asi que sin este paso una devolucion sin motivo se pintaria como «Motivo: »
 * seguido de nada, que se lee como un fallo de la pantalla y no como lo que es:
 * alguien devolvio un trabajo sin decir por que.
 */
export function motivoLimpio(texto: string | null | undefined): string | null {
  if (typeof texto !== "string") return null;
  const limpio = texto.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * `Tarea.nota_reporte` es UNA columna que se sobreescribe en cada reporte, asi
 * que solo describe el ultimo. Pegarla en los intentos viejos pondria en boca
 * del contratista, en marzo, algo que escribio en agosto.
 */
export function notaVisible(
  nota: string | null,
  intento: number,
  intentosTotales: number,
): string | null {
  return intento === intentosTotales ? nota : null;
}

// ─── Rango de fechas del filtro ──────────────────────────────────────────────

export interface RangoFechas {
  desde: Date | null;
  hasta: Date | null;
}

/**
 * Convierte los dos `YYYY-MM-DD` de la URL en un rango usable.
 *
 * Se construye con `new Date(a, m - 1, d)` y no con `new Date("2026-01-15")`:
 * la segunda forma es UTC, y en Colombia (UTC-5) eso corre el limite cinco
 * horas, asi que «desde el 15» empezaria a las 7 de la tarde del 14. Y `hasta`
 * se estira al ultimo milisegundo del dia, porque un filtro «hasta el 15» que
 * corta a las 00:00 pierde el dia entero que el usuario pidio.
 */
export function rangoFechas(desde?: string | null, hasta?: string | null): RangoFechas {
  return {
    desde: parseFecha(desde, false),
    hasta: parseFecha(hasta, true),
  };
}

const FORMATO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseFecha(texto: string | null | undefined, finDeDia: boolean): Date | null {
  if (!texto) return null;
  const m = FORMATO_FECHA.exec(texto);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = finDeDia
    ? new Date(anio, mes - 1, dia, 23, 59, 59, 999)
    : new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  // Round-trip: descarta 2026-02-31 y 2026-13-01, que `Date` acepta corriendo
  // el mes en silencio. Un filtro que se desplaza solo es peor que uno vacio.
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return d;
}

// ─── Formato ─────────────────────────────────────────────────────────────────

/** Duracion en horas -> texto corto en espanol. `null` se pinta como raya. */
export function formatearDuracionHoras(horas: number | null): string {
  if (horas === null || !Number.isFinite(horas)) return "—";
  if (horas < 1) return "<1 h";
  if (horas < 2 * DIA_HORAS) return `${Math.round(horas)} h`;
  const dias = horas / DIA_HORAS;
  if (dias < 10) return `${dias.toFixed(1).replace(".", ",")} d`;
  return `${Math.round(dias)} d`;
}

/** Porcentaje con un decimal y coma, como se escribe en espanol. */
export function formatearPorcentaje(pct: number): string {
  return `${pct.toFixed(1).replace(".", ",")}%`;
}
