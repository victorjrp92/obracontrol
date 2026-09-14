// ─────────────────────────────────────────────────────────────────────────
// REPARTO DEL CRONOGRAMA PLANEADO. Módulo PURO: sin Prisma, sin React, sin
// reloj y sin azar. Misma entrada, misma salida — se ejecuta igual en el
// navegador (el asistente valida y pre-rellena con él) que en las dos rutas
// de API (que persisten lo que devuelve).
//
// ══ LA DISTINCIÓN QUE GOBIERNA TODO: DÍAS NO ES FECHAS ═════════════════════
//
// `tiempo_acordado_dias` / `tiempo_estimado_dias` son una DURACIÓN: cuánto
// dura. `fecha_inicio_plan` / `fecha_fin_plan` son una POSICIÓN EN EL
// CALENDARIO: cuándo ocurre. Una duración no dice dónde cae, y por eso
// encadenar duraciones en fila NO produce un cronograma: produce el
// cronograma de una obra imaginaria de una sola torre.
//
// (Y ojo con `Tarea.fecha_inicio`, que no se toca aquí: esa es REAL, se
// rellena al reportar. El plan son las dos `_plan`.)
//
// ══ POR QUÉ ESTO NO ES `src/lib/cronograma/` ═══════════════════════════════
//
// En `src/lib/cronograma/` vive un motor completo —CPM, SGS serial, Monte
// Carlo— y NO es lo que hace falta aquí. Aquel motor contesta «CUÁNTO dura
// la obra» partiendo de las duraciones y las precedencias: la fecha de fin es
// su SALIDA. Aquí la fecha de fin es un DATO que pone el cliente, y la
// pregunta es la contraria: dado que la obra va del día X al día Y, ¿en qué
// trozo de ese calendario cae cada fase y cada tarea? Meter el CPM a repartir
// una ventana ya cerrada sería usar un martillo para atornillar.
//
// Lo que sí se reusa, y es lo que importa, es el CALENDARIO:
// `calendario-colombia.ts` —`esHabil` con los 18 festivos y la jornada del
// proyecto— y `fechaUTCDesde` de `cronograma/fechas.ts`. Ni un día festivo ni
// un domingo se reimplementa aquí.
//
// ══ LAS FASES SE SOLAPAN ═══════════════════════════════════════════════════
//
// En una obra de tres torres, la Torre 1 está en pintura mientras la Torre 3
// sigue en mampostería. Poner las fases en fila —mampostería, luego pintura,
// luego carpintería— da un plan que nadie va a cumplir y contra el que medir
// el avance miente. Por eso el modo AUTOMÁTICO encadena las fases con un
// SOLAPE: cada fase arranca cuando la anterior lleva `1 − SOLAPE` de su
// ventana recorrido. Ver `SOLAPE_FASES_AUTOMATICO`.
// ─────────────────────────────────────────────────────────────────────────

import {
  DIAS_HABILES_SEMANA_DEFECTO,
  aDiaUTC,
  claveDia,
  esHabil,
} from "./calendario-colombia";
import { fechaUTCDesde } from "./cronograma/fechas";

/** Cómo se construyó el cronograma. Espeja el enum `ModoCronograma` de Prisma. */
export type ModoCronograma = "AUTOMATICO" | "FASES" | "MANUAL";

/** Una posición en el calendario: dos días, ambos incluidos. */
export interface Ventana {
  inicio: Date;
  fin: Date;
}

/** Ventana tal como llega de un `<input type="date">` o de la base de datos. */
export interface VentanaEntrada {
  inicio?: string | Date | null;
  fin?: string | Date | null;
}

export interface FaseReparto {
  /** Nombre de la fase. Es la clave: dentro de un proyecto es único. */
  nombre: string;
  /** Posición constructiva (1 = la que abre la obra). */
  orden: number;
  /**
   * `tiempo_estimado_dias` de la fase, si el usuario lo puso. Aquí se usa SOLO
   * como PESO para repartir la ventana de la obra — una duración no dice
   * dónde cae. Si falta, el peso sale de la suma de sus tareas.
   */
  dias?: number | null;
  /** La ventana que puso el usuario. Obligatoria en modo FASES y MANUAL. */
  ventana?: VentanaEntrada | null;
}

export interface TareaReparto {
  /** Clave estable dentro del reparto (el llamador decide cuál). */
  id: string;
  /** Nombre de la fase a la que pertenece. */
  fase: string;
  /** `tiempo_acordado_dias`: DURACIÓN. Es el peso del reparto dentro de la fase. */
  dias: number;
  /** La ventana que puso el usuario. Obligatoria solo en modo MANUAL. */
  ventana?: VentanaEntrada | null;
}

export interface EntradaReparto {
  /** Inicio de la OBRA. Obligatorio. */
  inicio: string | Date | null | undefined;
  /** Fin de la OBRA. Obligatorio. */
  fin: string | Date | null | undefined;
  /** Jornada del proyecto (`dias_habiles_semana`). Por defecto 6 (Lu–Sá). */
  diasHabilesSemana?: number;
  modo: ModoCronograma;
  fases: FaseReparto[];
  tareas: TareaReparto[];
  /** Solape entre fases consecutivas, 0–0.9. Solo se usa en AUTOMATICO. */
  solape?: number;
}

export interface ResultadoReparto {
  /** `false` si la entrada era contradictoria: entonces NO hay fechas. */
  ok: boolean;
  /** Por qué se rechazó. Vacío si `ok`. Es lo que se le enseña al usuario. */
  motivos: string[];
  /** Cosas que el usuario debería saber pero no impiden guardar. */
  avisos: string[];
  /** Ventana de cada fase, por nombre de fase. */
  fases: Map<string, Ventana>;
  /** Ventana de cada tarea, por el `id` con que entró. */
  tareas: Map<string, Ventana>;
}

/**
 * **Cuánto se solapa una fase con la siguiente, en modo AUTOMÁTICO.**
 *
 * CRITERIO: la fase N+1 arranca cuando la fase N lleva el 75% de su ventana
 * recorrido. Es decir, el último cuarto de cada fase convive con el primer
 * tramo de la siguiente.
 *
 * POR QUÉ 0.25 Y NO OTRO NÚMERO. Los dos extremos son las dos formas de
 * mentir: con 0 las fases van en fila india y el plan describe una obra de
 * una sola torre —la de tres torres se pasa de largo el día uno—; con 1 todas
 * las fases empiezan el mismo día, que es un plan sin orden constructivo
 * (nadie pinta antes de levantar el muro). Un cuarto es el punto donde la
 * primera torre ya liberó su frente de trabajo mientras la última sigue en la
 * fase anterior, que es exactamente el solape que un residente de obra
 * describe cuando se le pregunta.
 *
 * Es un PARÁMETRO, no un número mágico enterrado: `EntradaReparto.solape` lo
 * cambia sin tocar este módulo, y `repartirCronograma` lo acota a [0, 0.9]
 * porque con 1 la obra entera cabría en la duración de una sola fase.
 */
export const SOLAPE_FASES_AUTOMATICO = 0.25;

/** Tope de solape admitido. Con 1 el reparto degeneraría a «todo en paralelo». */
const SOLAPE_MAXIMO = 0.9;

/**
 * Tope de días de calendario que puede abarcar una obra: 10 años. No es una
 * regla de negocio, es un freno — un año tecleado como 9999 colgaría el bucle
 * que enumera los días hábiles.
 */
const MAX_DIAS_OBRA = 366 * 10;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** «YYYY-MM-DD» (UTC): lo que come un `<input type="date">` y el payload JSON. */
export function fechaISO(d: Date): string {
  return claveDia(d);
}

/**
 * Los días HÁBILES del intervalo `[inicio, fin]`, AMBOS INCLUIDOS, en orden.
 *
 * Inclusivo a propósito, al revés que `diasHabilesEntre` —que cuenta
 * `[inicio, fin)` porque mide una duración—: aquí `fin` es el último día que
 * el usuario declaró de obra, y dejarlo fuera le robaría un día al plan.
 *
 * Devuelve las FECHAS y no un conteo porque el reparto necesita indexar: la
 * fase que ocupa del día hábil 12 al 30 se lee directamente de esta lista, sin
 * volver a caminar el calendario.
 */
export function diasHabilesDeRango(
  inicio: Date,
  fin: Date,
  diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): Date[] {
  const desde = aDiaUTC(inicio);
  const hasta = aDiaUTC(fin);
  if (!Number.isFinite(desde.getTime()) || !Number.isFinite(hasta.getTime())) return [];
  if (hasta.getTime() < desde.getTime()) return [];

  const out: Date[] = [];
  let cursor = desde;
  for (let i = 0; i <= MAX_DIAS_OBRA && cursor.getTime() <= hasta.getTime(); i++) {
    if (esHabil(cursor, diasSemana)) out.push(cursor);
    cursor = new Date(cursor.getTime() + MS_POR_DIA);
  }
  return out;
}

/** Días hábiles que tiene una ventana, con los dos extremos incluidos. */
export function diasHabilesVentana(
  v: Ventana,
  diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): number {
  return diasHabilesDeRango(v.inicio, v.fin, diasSemana).length;
}

/** ¿`dentro` cabe entera dentro de `fuera`? Comparación a día, en UTC. */
export function ventanaContenida(dentro: Ventana, fuera: Ventana): boolean {
  return (
    dentro.inicio.getTime() >= fuera.inicio.getTime() &&
    dentro.fin.getTime() <= fuera.fin.getTime()
  );
}

/**
 * Reparte `total` unidades enteras entre `pesos` proporcionalmente, por el
 * método del RESTO MAYOR: cada uno se lleva la parte entera de lo que le toca
 * y las unidades que sobran van a los mayores restos.
 *
 * La suma de la salida es EXACTAMENTE `total` — esa es la razón de usar resto
 * mayor y no redondear cada parte por separado: redondeando suelto, quince
 * tareas de 2,5 días se comen tres días que la fase no tiene y la última tarea
 * se sale por el otro lado.
 *
 * Empates por resto: gana el índice menor. Determinista.
 */
export function repartirEnteros(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const t = Math.max(0, Math.trunc(total));
  const limpios = pesos.map((p) => (Number.isFinite(p) && p > 0 ? p : 0));
  const suma = limpios.reduce((a, b) => a + b, 0);
  // Sin pesos utilizables el reparto es a partes iguales: no hay información
  // para preferir a nadie, y dárselo todo al primero sería inventarse un orden.
  const efectivos = suma > 0 ? limpios : new Array(n).fill(1);
  const total_pesos = suma > 0 ? suma : n;

  const exactos = efectivos.map((p) => (t * p) / total_pesos);
  const base = exactos.map((e) => Math.floor(e));
  let restante = t - base.reduce((a, b) => a + b, 0);

  const orden = exactos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => (b.resto - a.resto) || (a.i - b.i));
  for (let k = 0; k < orden.length && restante > 0; k++) {
    base[orden[k].i]++;
    restante--;
  }
  return base;
}

/** Normaliza una ventana de entrada; `null` si le falta alguna de las dos fechas. */
function leerVentana(v: VentanaEntrada | null | undefined): Ventana | null {
  const inicio = fechaUTCDesde(v?.inicio ?? null);
  const fin = fechaUTCDesde(v?.fin ?? null);
  if (!inicio || !fin) return null;
  return { inicio, fin };
}

function resultadoVacio(motivos: string[]): ResultadoReparto {
  return { ok: false, motivos, avisos: [], fases: new Map(), tareas: new Map() };
}

/**
 * Convierte un tramo de ÍNDICES sobre una lista de días hábiles en una
 * ventana de fechas. Los índices se acotan a la lista, así que la ventana
 * resultante NUNCA se sale del rango del que salió la lista — de ahí que la
 * contención «fase dentro de obra» y «tarea dentro de fase» sea estructural y
 * no una comprobación que alguien pueda olvidarse de hacer.
 */
function ventanaDeIndices(habiles: Date[], desde: number, hasta: number): Ventana {
  const ultimo = habiles.length - 1;
  const i0 = Math.min(Math.max(0, desde), ultimo);
  const i1 = Math.min(Math.max(i0, hasta), ultimo);
  return { inicio: habiles[i0], fin: habiles[i1] };
}

/**
 * Ventanas de las fases en modo AUTOMÁTICO: el sistema reparte toda la
 * ventana de la obra.
 *
 * Cómo: cada fase recibe una longitud proporcional a su peso; las fases se
 * encadenan desplazando cada arranque `(1 − solape)` de la longitud de la
 * anterior; y el conjunto se ESCALA para que el último día ocupado sea el
 * último día hábil de la obra. El escalado final es lo que garantiza que
 * ninguna fase se salga, sea cual sea el solape y sean cuales sean los pesos.
 */
function ventanasAutomaticas(
  fases: FaseReparto[],
  pesos: number[],
  habiles: Date[],
  solape: number,
): Map<string, Ventana> {
  const out = new Map<string, Ventana>();
  const n = fases.length;
  if (n === 0 || habiles.length === 0) return out;

  // Longitudes y arranques en unidades ARBITRARIAS (el peso). Se escalan al
  // final, así que aquí no hace falta que signifiquen días.
  const largos = pesos.map((p) => (Number.isFinite(p) && p > 0 ? p : 1));
  const arranques: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    arranques[i] = arranques[i - 1] + (1 - solape) * largos[i - 1];
  }
  let spanCrudo = 0;
  for (let i = 0; i < n; i++) spanCrudo = Math.max(spanCrudo, arranques[i] + largos[i]);
  if (spanCrudo <= 0) spanCrudo = 1;

  const k = habiles.length / spanCrudo;
  for (let i = 0; i < n; i++) {
    const desde = Math.round(arranques[i] * k);
    const hasta = Math.round((arranques[i] + largos[i]) * k) - 1;
    out.set(fases[i].nombre, ventanaDeIndices(habiles, desde, hasta));
  }
  return out;
}

/**
 * **El reparto.** Devuelve una ventana para cada fase y cada tarea, o el
 * motivo por el que no se puede repartir.
 *
 * REGLA QUE NO SE NEGOCIA: lo que puso el usuario NO se toca. En modo FASES
 * las ventanas de fase salen tal cual entraron; en MANUAL, también las de
 * tarea. El sistema solo rellena lo que el modo le deja rellenar.
 */
export function repartirCronograma(entrada: EntradaReparto): ResultadoReparto {
  const motivos: string[] = [];
  const avisos: string[] = [];

  // ── La ventana de la obra ────────────────────────────────────────────────
  const inicioObra = fechaUTCDesde(entrada.inicio ?? null);
  const finObra = fechaUTCDesde(entrada.fin ?? null);
  if (!inicioObra) motivos.push("La obra necesita fecha de inicio.");
  if (!finObra) motivos.push("La obra necesita fecha de fin.");
  if (!inicioObra || !finObra) return resultadoVacio(motivos);

  if (finObra.getTime() < inicioObra.getTime()) {
    return resultadoVacio([
      `La fecha de fin de la obra (${fechaISO(finObra)}) es anterior a la de inicio (${fechaISO(inicioObra)}).`,
    ]);
  }
  if ((finObra.getTime() - inicioObra.getTime()) / MS_POR_DIA > MAX_DIAS_OBRA) {
    return resultadoVacio([
      `La obra abarca más de ${Math.round(MAX_DIAS_OBRA / 366)} años: revisa las fechas.`,
    ]);
  }

  const diasSemana = entrada.diasHabilesSemana ?? DIAS_HABILES_SEMANA_DEFECTO;
  const ventanaObra: Ventana = { inicio: inicioObra, fin: finObra };
  const habilesObra = diasHabilesDeRango(inicioObra, finObra, diasSemana);
  if (habilesObra.length === 0) {
    return resultadoVacio([
      `Entre ${fechaISO(inicioObra)} y ${fechaISO(finObra)} no hay ni un día hábil: con ${diasSemana} días/semana y los festivos, no queda día de trabajo.`,
    ]);
  }

  if (entrada.modo !== "AUTOMATICO" && entrada.modo !== "FASES" && entrada.modo !== "MANUAL") {
    return resultadoVacio([`Modo de cronograma desconocido: "${String(entrada.modo)}".`]);
  }

  // ── Fases, en orden constructivo ─────────────────────────────────────────
  // Sin fases no hay nada que repartir, pero tampoco hay error: una obra a la
  // que todavía no se le han puesto fases es un borrador legítimo.
  const fases = [...(entrada.fases ?? [])].sort(
    (a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre),
  );
  const nombresFase = new Set(fases.map((f) => f.nombre));

  const tareas = entrada.tareas ?? [];
  for (const t of tareas) {
    if (!nombresFase.has(t.fase)) {
      motivos.push(`La tarea "${t.id}" apunta a la fase "${t.fase}", que no está en el proyecto.`);
    }
  }
  if (motivos.length > 0) return resultadoVacio(motivos);

  const tareasPorFase = new Map<string, TareaReparto[]>();
  for (const f of fases) tareasPorFase.set(f.nombre, []);
  for (const t of tareas) tareasPorFase.get(t.fase)!.push(t);

  // ── Ventanas de fase ─────────────────────────────────────────────────────
  let ventanasFase: Map<string, Ventana>;

  if (entrada.modo === "AUTOMATICO") {
    const solapeCrudo = entrada.solape ?? SOLAPE_FASES_AUTOMATICO;
    const solape = Math.min(SOLAPE_MAXIMO, Math.max(0, Number.isFinite(solapeCrudo) ? solapeCrudo : SOLAPE_FASES_AUTOMATICO));
    // Peso de la fase: su duración declarada si la hay; si no, la suma de las
    // duraciones de sus tareas; y si tampoco, 1 — una fase sin tareas sigue
    // ocupando sitio en el calendario, no se puede colapsar a cero.
    const pesos = fases.map((f) => {
      if (f.dias != null && Number.isFinite(f.dias) && f.dias > 0) return f.dias;
      const suma = (tareasPorFase.get(f.nombre) ?? []).reduce(
        (acc, t) => acc + (Number.isFinite(t.dias) && t.dias > 0 ? t.dias : 0),
        0,
      );
      return suma > 0 ? suma : 1;
    });
    ventanasFase = ventanasAutomaticas(fases, pesos, habilesObra, solape);
  } else {
    // FASES y MANUAL: las ventanas son del usuario. Se validan y se copian
    // TAL CUAL — ni se ajustan a día hábil ni se estiran a la obra.
    ventanasFase = new Map();
    for (const f of fases) {
      const v = leerVentana(f.ventana);
      if (!v) {
        motivos.push(`La fase "${f.nombre}" necesita fecha de inicio y de fin.`);
        continue;
      }
      if (v.fin.getTime() < v.inicio.getTime()) {
        motivos.push(`La fase "${f.nombre}" termina (${fechaISO(v.fin)}) antes de empezar (${fechaISO(v.inicio)}).`);
        continue;
      }
      if (!ventanaContenida(v, ventanaObra)) {
        motivos.push(
          `La fase "${f.nombre}" (${fechaISO(v.inicio)} → ${fechaISO(v.fin)}) se sale de la obra (${fechaISO(inicioObra)} → ${fechaISO(finObra)}).`,
        );
        continue;
      }
      ventanasFase.set(f.nombre, v);
    }
    if (motivos.length > 0) return resultadoVacio(motivos);
  }

  // ── Ventanas de tarea ────────────────────────────────────────────────────
  const ventanasTarea = new Map<string, Ventana>();

  if (entrada.modo === "MANUAL") {
    // El sistema NO interviene: solo comprueba que lo que puso el usuario es
    // coherente. Una tarea fuera de su fase no es un detalle estético — es un
    // plan contra el que el avance mediría cualquier cosa.
    for (const t of tareas) {
      const vf = ventanasFase.get(t.fase)!;
      const v = leerVentana(t.ventana);
      if (!v) {
        motivos.push(`La tarea "${t.id}" necesita fecha de inicio y de fin (modo manual).`);
        continue;
      }
      if (v.fin.getTime() < v.inicio.getTime()) {
        motivos.push(`La tarea "${t.id}" termina (${fechaISO(v.fin)}) antes de empezar (${fechaISO(v.inicio)}).`);
        continue;
      }
      if (!ventanaContenida(v, vf)) {
        motivos.push(
          `La tarea "${t.id}" (${fechaISO(v.inicio)} → ${fechaISO(v.fin)}) se sale de su fase "${t.fase}" (${fechaISO(vf.inicio)} → ${fechaISO(vf.fin)}).`,
        );
        continue;
      }
      ventanasTarea.set(t.id, v);
    }
    if (motivos.length > 0) return resultadoVacio(motivos);
  } else {
    // AUTOMATICO y FASES: dentro de cada fase, las tareas se reparten
    // PROPORCIONALMENTE a sus días acordados, en el orden en que entraron.
    for (const f of fases) {
      const vf = ventanasFase.get(f.nombre);
      const deLaFase = tareasPorFase.get(f.nombre) ?? [];
      if (!vf || deLaFase.length === 0) continue;

      const habilesFase = diasHabilesDeRango(vf.inicio, vf.fin, diasSemana);
      if (habilesFase.length === 0) {
        // La ventana que puso el usuario no tiene un solo día de trabajo (un
        // fin de semana largo, por ejemplo). No se le mueve la ventana: se le
        // da a cada tarea la de la fase y se le avisa.
        avisos.push(
          `La fase "${f.nombre}" (${fechaISO(vf.inicio)} → ${fechaISO(vf.fin)}) no tiene ningún día hábil: sus tareas heredan la ventana completa de la fase.`,
        );
        for (const t of deLaFase) ventanasTarea.set(t.id, { ...vf });
        continue;
      }

      const reparto = repartirEnteros(
        habilesFase.length,
        deLaFase.map((t) => (Number.isFinite(t.dias) && t.dias > 0 ? t.dias : 0)),
      );
      let cursor = 0;
      for (let i = 0; i < deLaFase.length; i++) {
        const desde = cursor;
        const hasta = cursor + reparto[i] - 1; // último día que ocupa la tarea
        ventanasTarea.set(deLaFase[i].id, ventanaDeIndices(habilesFase, desde, hasta));
        cursor += reparto[i];
      }
      if (habilesFase.length < deLaFase.length) {
        avisos.push(
          `La fase "${f.nombre}" tiene ${deLaFase.length} tareas y solo ${habilesFase.length} día(s) hábil(es): varias tareas comparten día.`,
        );
      }
    }
  }

  return { ok: true, motivos: [], avisos, fases: ventanasFase, tareas: ventanasTarea };
}
