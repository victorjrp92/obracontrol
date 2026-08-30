// ─────────────────────────────────────────────────────────────────────────
// CALENDARIO LABORAL COLOMBIANO. Módulo PURO, DETERMINISTA y SIN DEPENDENCIAS:
// no lee el reloj (`Date.now`), no toca DB, no usa librerías de fechas. Todas
// las cuentas se hacen en UTC para que el resultado no dependa de la zona
// horaria de la máquina — Colombia es UTC−5 y no tiene horario de verano, así
// que a granularidad de DÍA la diferencia solo importaría en las 5 h alrededor
// de la medianoche.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Hasta este módulo, en TODO el repo no había un solo festivo colombiano: el
// único cálculo de día hábil (`scoring.calcularDiasHabiles`) excluía sábados y
// domingos y nada más. Colombia tiene **18 festivos al año**: 6–7% del
// calendario, ~14 días hábiles perdidos en una semana de seis días. Una obra
// de tres meses se corre casi una semana entera solo por eso.
//
// ══ LOS 18 FESTIVOS, GENERADOS — NO LISTADOS ═══════════════════════════════
//
// Una lista escrita a mano caduca cada 31 de diciembre y nadie se acuerda de
// actualizarla. Aquí los 18 se DERIVAN, año a año, de tres reglas:
//
//  1. SEIS fijos SIN traslado (los de fecha "intocable" por ley):
//     1 ene · 1 may · 20 jul · 7 ago · 8 dic · 25 dic.
//
//  2. SIETE fijos CON traslado al lunes siguiente — **Ley 51 de 1983**, la
//     «Ley Emiliani», que movió los puentes para no partir la semana laboral:
//     6 ene · 19 mar · 29 jun · 15 ago · 12 oct · 1 nov · 11 nov.
//     Si la fecha base YA cae en lunes, se queda donde está (no se corre otra
//     semana): el traslado es «al lunes siguiente», no «al lunes de después».
//
//  3. CINCO móviles anclados a la PASCUA, calculada con el algoritmo gregoriano
//     anónimo (Meeus/Jones/Butcher) — quince líneas de aritmética entera:
//       · Jueves Santo      = Pascua − 3   (sin traslado)
//       · Viernes Santo     = Pascua − 2   (sin traslado)
//       · Ascensión         = Pascua + 39, trasladada → Pascua + 43
//       · Corpus Christi    = Pascua + 60, trasladada → Pascua + 64
//       · Sagrado Corazón   = Pascua + 68, trasladada → Pascua + 71
//     Los tres móviles trasladables caen SIEMPRE en el mismo día de la semana
//     (Ascensión y Corpus en jueves, Sagrado Corazón en viernes: +39, +60 y
//     +68 sobre un domingo), así que el traslado suma siempre +4, +4 y +3 —
//     de ahí los desplazamientos netos +43, +64 y +71 del enunciado.
//
//  6 + 7 + 2 + 3 = 18. Ni uno más, ni uno menos.
//
// ⚠️ DOS FESTIVOS PUEDEN COINCIDIR EN LA MISMA FECHA. No es un bug del módulo,
// es el calendario real: en 2025 el Sagrado Corazón (Pascua+71 = 30 jun) y San
// Pedro y San Pablo (29 jun, domingo → lunes 30 jun) caen los dos el 30 de
// junio. Ese año Colombia tiene 18 festivos en 17 días distintos. Por eso
// `festivosColombia()` devuelve 18 ENTRADAS y `esFestivo()` trabaja sobre el
// conjunto de fechas DISTINTAS.
//
// ══ QUÉ MÁS VIVE AQUÍ ══════════════════════════════════════════════════════
//
// La ÚNICA definición de «día hábil» del repo (`esHabil`) y las dos únicas
// operaciones de calendario que necesita el motor de duración:
//   · `addWorkingDays` — de una duración en días hábiles a una fecha de fin.
//   · `diasHabilesEntre` — de dos fechas a una duración en días hábiles.
//   · `rho` — el factor de conversión días hábiles ⇄ días calendario, que es
//     lo que permite sumar una espera de secado (calendario) a un presupuesto
//     de trabajo (hábiles) sin mezclar unidades.
// ─────────────────────────────────────────────────────────────────────────

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días hábiles/semana por defecto: la construcción colombiana trabaja Lu–Sá. */
export const DIAS_HABILES_SEMANA_DEFECTO = 6;

/** Tope de iteración de los bucles de calendario: 20 años. Guarda de cordura. */
const MAX_DIAS_ITERACION = 366 * 20;

// ─────────────────────────────────────────────────────────────────────────
// Utilidades de fecha (UTC, sin librerías)
// ─────────────────────────────────────────────────────────────────────────

/** Medianoche UTC del día de `d`. No muta la entrada. */
export function aDiaUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Fecha UTC a partir de año / mes 1-12 / día. */
function fechaUTC(anio: number, mes1a12: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes1a12 - 1, dia));
}

/** `d` desplazada `n` días calendario (n puede ser negativo). No muta. */
function sumarDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_POR_DIA);
}

/** Clave estable de un día para índices y comparaciones: "YYYY-MM-DD" (UTC). */
export function claveDia(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  return `${y}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
}

/** Días que tiene el año (365 o 366). */
export function diasDelAnio(anio: number): number {
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return bisiesto ? 366 : 365;
}

// ─────────────────────────────────────────────────────────────────────────
// Pascua — algoritmo gregoriano anónimo (Meeus / Jones / Butcher)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Domingo de Pascua del año dado (calendario gregoriano), en UTC.
 *
 * Aritmética ENTERA pura: no hay tabla, no hay aproximación y no caduca. El
 * algoritmo reconstruye la regla de Nicea —primer domingo tras la primera luna
 * llena eclesiástica posterior al equinoccio— combinando el ciclo metónico de
 * 19 años (`a`) con las correcciones gregorianas de siglo (`d`, `e`, `f`, `g`).
 *
 * Comprobado contra el calendario oficial: 2025 → 20 abr · 2026 → 5 abr ·
 * 2027 → 28 mar (ver `scripts/verificar-calendario.ts`).
 */
export function pascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaUTC(anio, mes, dia);
}

// ─────────────────────────────────────────────────────────────────────────
// Los 18 festivos
// ─────────────────────────────────────────────────────────────────────────

/** Un festivo del año, con la trazabilidad de cómo se obtuvo su fecha. */
export interface Festivo {
  /** Fecha EFECTIVA (ya trasladada si aplicaba), medianoche UTC. */
  fecha: Date;
  nombre: string;
  /** Fecha original antes del traslado. Igual a `fecha` si no se trasladó. */
  base: Date;
  /** true si la Ley Emiliani lo corrió al lunes siguiente. */
  trasladado: boolean;
  /** Regla que lo genera. Útil para verificar que son 6 / 7 / 2 / 3. */
  regla: "fijo" | "emiliani" | "pascual" | "pascual-emiliani";
}

/** Los 6 fijos que la ley NO mueve: [mes 1-12, día, nombre]. */
const FIJOS_SIN_TRASLADO: readonly [number, number, string][] = [
  [1, 1, "Año Nuevo"],
  [5, 1, "Día del Trabajo"],
  [7, 20, "Independencia de Colombia"],
  [8, 7, "Batalla de Boyacá"],
  [12, 8, "Inmaculada Concepción"],
  [12, 25, "Navidad"],
];

/** Los 7 fijos que la Ley 51 de 1983 corre al lunes siguiente. */
const FIJOS_EMILIANI: readonly [number, number, string][] = [
  [1, 6, "Reyes Magos"],
  [3, 19, "San José"],
  [6, 29, "San Pedro y San Pablo"],
  [8, 15, "Asunción de la Virgen"],
  [10, 12, "Día de la Raza"],
  [11, 1, "Todos los Santos"],
  [11, 11, "Independencia de Cartagena"],
];

/**
 * Traslado de la **Ley 51 de 1983 («Ley Emiliani»)**: al lunes siguiente.
 *
 * Si la fecha ya cae en lunes se queda donde está — el texto dice «se
 * trasladará al lunes siguiente», y un lunes ya ES el lunes de esa semana.
 * Correrlo otra semana sería inventarse un festivo que no existe.
 */
export function trasladarALunes(d: Date): Date {
  const dow = d.getUTCDay(); // 0 = domingo, 1 = lunes
  if (dow === 1) return d;
  // Días hasta el próximo lunes: domingo → 1, martes → 6, …, sábado → 2.
  return sumarDias(d, (8 - dow) % 7);
}

const cacheFestivos = new Map<number, Festivo[]>();

/**
 * Los 18 festivos colombianos del año, en orden cronológico.
 *
 * Devuelve 18 ENTRADAS siempre. Las FECHAS distintas pueden ser 17 si dos
 * festivos coinciden (2025: Sagrado Corazón y San Pedro y San Pablo, ambos el
 * 30 de junio). Ver la cabecera del módulo.
 */
export function festivosColombia(anio: number): Festivo[] {
  // Copia superficial: el caché es del módulo, no del llamador. Devolver el
  // array interno dejaba que un `.push()` de cualquiera envenenara el
  // calendario de todo el proceso. Son 18 elementos; la copia no se nota.
  return festivosDelAnio(anio).slice();
}

/** El array CACHEADO. Interno: nadie de fuera lo toca. */
function festivosDelAnio(anio: number): Festivo[] {
  const cacheado = cacheFestivos.get(anio);
  if (cacheado) return cacheado;

  const out: Festivo[] = [];

  for (const [mes, dia, nombre] of FIJOS_SIN_TRASLADO) {
    const f = fechaUTC(anio, mes, dia);
    out.push({ fecha: f, nombre, base: f, trasladado: false, regla: "fijo" });
  }

  for (const [mes, dia, nombre] of FIJOS_EMILIANI) {
    const base = fechaUTC(anio, mes, dia);
    const fecha = trasladarALunes(base);
    out.push({
      fecha,
      nombre,
      base,
      trasladado: fecha.getTime() !== base.getTime(),
      regla: "emiliani",
    });
  }

  const p = pascua(anio);
  // Jueves y Viernes Santo NO se trasladan: son la Semana Santa, no un puente.
  out.push({ fecha: sumarDias(p, -3), nombre: "Jueves Santo", base: sumarDias(p, -3), trasladado: false, regla: "pascual" });
  out.push({ fecha: sumarDias(p, -2), nombre: "Viernes Santo", base: sumarDias(p, -2), trasladado: false, regla: "pascual" });

  // Los tres móviles con traslado. Sus fechas canónicas caen siempre en el
  // mismo día de la semana (jueves, jueves y viernes), así que el traslado
  // vale siempre +4, +4 y +3 — o sea Pascua+43, +64 y +71. Aun así se pasa por
  // `trasladarALunes` en vez de sumar el offset ya trasladado: manda la regla,
  // no el atajo aritmético.
  const MOVILES_EMILIANI: readonly [number, string][] = [
    [39, "Ascensión del Señor"],
    [60, "Corpus Christi"],
    [68, "Sagrado Corazón de Jesús"],
  ];
  for (const [offset, nombre] of MOVILES_EMILIANI) {
    const base = sumarDias(p, offset);
    const fecha = trasladarALunes(base);
    out.push({
      fecha,
      nombre,
      base,
      trasladado: fecha.getTime() !== base.getTime(),
      regla: "pascual-emiliani",
    });
  }

  out.sort((x, y) => x.fecha.getTime() - y.fecha.getTime());
  cacheFestivos.set(anio, out);
  return out;
}

const cacheTiemposFestivos = new Map<number, Set<number>>();

/**
 * Instantes (medianoche UTC) DISTINTOS con festivo en el año — 17 o 18, ver la
 * cabecera. Se indexa por número y no por string a propósito: `esFestivo` se
 * llama una vez por cada día que recorren `diasHabilesEntre` y
 * `addWorkingDays`, que a su vez corren una vez por tarea en los semáforos del
 * dashboard. Construir un "YYYY-MM-DD" por día ahí sería basura pura.
 */
function tiemposFestivos(anio: number): Set<number> {
  const cacheado = cacheTiemposFestivos.get(anio);
  if (cacheado) return cacheado;
  const s = new Set(festivosDelAnio(anio).map((f) => f.fecha.getTime()));
  cacheTiemposFestivos.set(anio, s);
  return s;
}

/** ¿Es `fecha` festivo nacional colombiano? (a granularidad de día, UTC). */
export function esFestivo(fecha: Date): boolean {
  const t = fecha.getTime();
  if (!Number.isFinite(t)) return false;
  return tiemposFestivos(fecha.getUTCFullYear()).has(aDiaUTC(fecha).getTime());
}

/** El festivo que cae en `fecha`, o null. Si hay dos, devuelve el primero. */
export function festivoDe(fecha: Date): Festivo | null {
  if (!Number.isFinite(fecha.getTime())) return null;
  const t = aDiaUTC(fecha).getTime();
  return festivosDelAnio(fecha.getUTCFullYear()).find((f) => f.fecha.getTime() === t) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Día hábil — LA definición
// ─────────────────────────────────────────────────────────────────────────

/**
 * Días de la SEMANA que no se trabajan, dado `dias_habiles_semana` (1–7).
 * El descanso se asigna desde el final de la semana: primero el domingo, luego
 * el sábado, luego el viernes… Números de `Date.getUTCDay()` (0 = domingo).
 */
const cacheDescanso = new Map<number, Set<number>>();

export function diasDescansoSemana(diasHabilesSemana: number): Set<number> {
  const s = Number.isFinite(diasHabilesSemana)
    ? Math.min(7, Math.max(1, Math.round(diasHabilesSemana)))
    : DIAS_HABILES_SEMANA_DEFECTO;
  const cacheado = cacheDescanso.get(s);
  if (cacheado) return cacheado;
  const ordenDescanso = [0, 6, 5, 4, 3, 2, 1]; // domingo, sábado, viernes…
  const set = new Set(ordenDescanso.slice(0, 7 - s));
  cacheDescanso.set(s, set);
  return set;
}

/**
 * **La única definición de «día hábil» del repo.** Un día es hábil si (a) no
 * cae en el descanso semanal del proyecto y (b) no es festivo nacional.
 *
 * El festivo pesa incluso con `diasSemana = 7`: un 25 de diciembre no se
 * trabaja porque el proyecto declare semana de siete días. La jornada del
 * proyecto decide los descansos ORDINARIOS; la ley decide los festivos.
 */
export function esHabil(fecha: Date, diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO): boolean {
  if (!Number.isFinite(fecha.getTime())) return false;
  if (diasDescansoSemana(diasSemana).has(fecha.getUTCDay())) return false;
  return !esFestivo(fecha);
}

/**
 * Fecha que resulta de sumar `dias` días HÁBILES a `inicio`.
 *
 * Convención: se cuenta a partir del día SIGUIENTE al de `inicio` y se devuelve
 * el día del `dias`-ésimo hábil. `dias = 0` devuelve el propio día de `inicio`
 * (medianoche UTC). Con `dias` negativo camina hacia atrás.
 *
 * Es la operación que cierra el motor de duración: `fin = addWorkingDays(
 * inicio, ⌈D⌉, S, H)` del spec §5.
 */
export function addWorkingDays(
  inicio: Date,
  dias: number,
  diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): Date {
  let cursor = aDiaUTC(inicio);
  const n = Math.trunc(dias);
  if (!Number.isFinite(n) || n === 0) return cursor;
  const paso = n > 0 ? 1 : -1;
  let restantes = Math.abs(n);
  for (let i = 0; i < MAX_DIAS_ITERACION && restantes > 0; i++) {
    cursor = sumarDias(cursor, paso);
    if (esHabil(cursor, diasSemana)) restantes--;
  }
  return cursor;
}

/**
 * Días HÁBILES ENTEROS contenidos en el intervalo `[inicio, fin)`, a
 * granularidad de día: cuenta los días hábiles cuyo comienzo (medianoche UTC)
 * cae en o después del día de `inicio` y ANTES del día de `fin`.
 *
 * Es la MISMA convención que traía `scoring.calcularDiasHabiles` —al que
 * sustituye— con dos diferencias deliberadas:
 *   1. ahora descuenta los 18 festivos, que es el entregable de este módulo;
 *   2. cuenta en UTC, no en la hora local del servidor, para que dos máquinas
 *      con zonas distintas no den semáforos distintos.
 *
 * `fin` anterior o igual a `inicio` → 0. Nunca devuelve negativos.
 */
export function diasHabilesEntre(
  inicio: Date,
  fin: Date,
  diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): number {
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime())) return 0;
  const desde = aDiaUTC(inicio);
  const hasta = aDiaUTC(fin);
  if (hasta.getTime() <= desde.getTime()) return 0;

  let dias = 0;
  let cursor = desde;
  for (let i = 0; i < MAX_DIAS_ITERACION && cursor.getTime() < hasta.getTime(); i++) {
    if (esHabil(cursor, diasSemana)) dias++;
    cursor = sumarDias(cursor, 1);
  }
  return dias;
}

/** Días hábiles que tiene un año concreto, con la jornada dada. */
export function diasHabilesEnAnio(
  anio: number,
  diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): number {
  return diasHabilesEntre(fechaUTC(anio, 1, 1), fechaUTC(anio + 1, 1, 1), diasSemana);
}

// ─────────────────────────────────────────────────────────────────────────
// ρ — el puente entre días hábiles y días calendario
// ─────────────────────────────────────────────────────────────────────────

/**
 * Ventana FIJA sobre la que se promedia ρ. Es fija a propósito: si dependiera
 * del año en curso, el motor de duración dejaría de ser puro (`ρ` cambiaría
 * cada 1 de enero y dos corridas idénticas darían números distintos).
 */
export const VENTANA_RHO: readonly [number, number] = [2026, 2045];

const cacheRho = new Map<number, number>();

/**
 * **Factor ρ = días hábiles ÷ días calendario**, promediado sobre `VENTANA_RHO`.
 *
 * Es la tasa a la que el calendario «gasta» días hábiles. Con semana de seis
 * días y 18 festivos, ρ ≈ 0.81: de cada 100 días de calendario, 81 son hábiles.
 *
 * PARA QUÉ SIRVE — la conversión de unidades del motor de duración. Una espera
 * de secado son días de CALENDARIO (el mortero fragua también el domingo y el
 * 25 de diciembre), pero el total de la obra se expresa en días HÁBILES, que
 * es lo que después consume `addWorkingDays`. Sumar los dos sin convertir es un
 * error de unidades: cobra cada día de secado como si fuera un día de trabajo
 * perdido. La conversión correcta es
 *
 *     Λ_hábiles = ρ · Λ_calendario
 *
 * porque en Λ días de calendario solo transcurren ρ·Λ días hábiles. Sin ella,
 * una espera de 10 días de fragüe de placa se cobra un 23% más cara de lo que
 * es (10 días hábiles ≈ 12.3 de calendario).
 */
export function rho(diasSemana: number = DIAS_HABILES_SEMANA_DEFECTO): number {
  const s = Math.min(7, Math.max(1, Math.round(diasSemana)));
  const cacheado = cacheRho.get(s);
  if (cacheado !== undefined) return cacheado;

  const [desde, hasta] = VENTANA_RHO;
  let habiles = 0;
  let calendario = 0;
  for (let anio = desde; anio <= hasta; anio++) {
    habiles += diasHabilesEnAnio(anio, s);
    calendario += diasDelAnio(anio);
  }
  const r = habiles / calendario;
  cacheRho.set(s, r);
  return r;
}
