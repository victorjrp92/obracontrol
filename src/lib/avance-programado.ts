// ─────────────────────────────────────────────────────────────────────────
// AVANCE EJECUTADO vs AVANCE PROGRAMADO: el trío de indicadores con el que se
// lee cualquier informe de interventoría colombiano.
//
// Hasta aquí el sistema sabía decir «vamos al 49%». Un 49% solo no dice nada:
// puede ser una obra adelantada o una obra hundida. Lo que se firma en un acta
// de seguimiento son TRES cifras juntas —tiempo transcurrido, avance ejecutado
// y avance programado— y su cociente, el SPI.
//
// ══ LA DISTINCIÓN QUE GOBIERNA TODO EL MÓDULO ══════════════════════════════
//
// DÍAS y FECHAS no son lo mismo:
//   · `tiempo_acordado_dias` / `tiempo_estimado_dias` son DURACIÓN: cuánto
//     dura algo.
//   · `fecha_inicio_plan` / `fecha_fin_plan` son POSICIÓN EN EL CALENDARIO:
//     cuándo ocurre.
// En una obra de tres torres las fases SE SOLAPAN —la torre 1 está en pintura
// mientras la torre 3 sigue en mampostería—, así que encadenar duraciones en
// fila produce un cronograma falso. Por eso el programado se calcula SIEMPRE
// sobre ventanas de calendario, nunca sobre duraciones encadenadas.
//
// Y ojo con `Tarea.fecha_inicio`: es REAL, se rellena AL REPORTAR. No es plan.
//
// ══ NULL NO ES CERO ════════════════════════════════════════════════════════
//
// Sin cronograma cargado, el programado devuelve `null`. Un cero diría «hoy no
// tocaba haber hecho nada», que es exactamente lo contrario de «no sabemos qué
// tocaba». Todas las obras que existen hoy están en ese caso: la pantalla debe
// decirlo, no pintar un cero ni un guion mudo.
//
// Módulo PURO y DETERMINISTA: sin Prisma, sin red y sin reloj — `hoy` entra
// siempre por parámetro, para que la verificación pueda fijar el día.
// ─────────────────────────────────────────────────────────────────────────

import { aDiaUTC } from "@/lib/calendario-colombia";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────
// Reglas de crédito — «Weighted % Complete» con «% Complete Limits»
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cuánto crédito de avance vale una tarea según su estado (0–1).
 *
 * Es la técnica «Weighted % Complete» con la variante «% Complete Limits»
 * descrita en la SAE EIA-748 (Earned Value Management): al trabajo declarado
 * pero no verificado se le pone un TOPE por debajo del 100%, de modo que
 * reportar no equivalga a terminar.
 *
 * El tope del 80% para REPORTADA es el que impide que una obra se declare
 * terminada sola: el contratista reporta, el 20% que falta lo libera el
 * interventor al aprobar. NO_APROBADA vuelve a cero a propósito — una tarea
 * devuelta con motivo es trabajo que hay que rehacer, no trabajo hecho.
 */
export const CREDITO_PENDIENTE = 0;
export const CREDITO_REPORTADA = 0.8;
export const CREDITO_APROBADA = 1;
export const CREDITO_NO_APROBADA = 0;

/**
 * Cuántos puntos porcentuales de diferencia contra el plan se toleran antes de
 * llamar «atrasada» a una fase. Sin banda, una fase 0,4 puntos por debajo se
 * pintaría en rojo y el rojo dejaría de significar algo.
 */
export const TOLERANCIA_ATRASO_PUNTOS = 5;

/**
 * Banda muerta del SPI alrededor de 1. Mismo motivo que la de arriba, pero en
 * unidades de cociente: 0,98 es «en plazo», no «atrasada».
 */
export const TOLERANCIA_SPI = 0.05;

/** El crédito de un estado. Un estado desconocido no suma: lo prudente es 0. */
export function creditoDeEstado(estado: string): number {
  switch (estado) {
    case "APROBADA":
      return CREDITO_APROBADA;
    case "REPORTADA":
      return CREDITO_REPORTADA;
    case "NO_APROBADA":
      return CREDITO_NO_APROBADA;
    default:
      return CREDITO_PENDIENTE;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Conteos por estado
// ─────────────────────────────────────────────────────────────────────────

/** Las cuatro casillas del enum `EstadoTarea`, ya contadas. */
export interface ConteoEstados {
  pendientes: number;
  /** REPORTADA: hecho y esperando revisión. NO incluye las aprobadas. */
  reportadas: number;
  aprobadas: number;
  /** NO_APROBADA: devuelta con motivo. */
  devueltas: number;
}

export const CONTEO_VACIO: ConteoEstados = {
  pendientes: 0,
  reportadas: 0,
  aprobadas: 0,
  devueltas: 0,
};

/**
 * Arma el conteo desde lo que devuelve un `groupBy` por estado.
 *
 * Se agrupa en la base y se cuenta aquí, en vez de traer las tareas: una obra
 * de tres torres tiene 4.110 y traerlas para contarlas es un viaje de más en
 * una página que ya venía lenta.
 */
export function conteoDesde(filas: { estado: string; cantidad: number }[]): ConteoEstados {
  const c: ConteoEstados = { ...CONTEO_VACIO };
  for (const f of filas) {
    const n = Number.isFinite(f.cantidad) ? f.cantidad : 0;
    if (f.estado === "APROBADA") c.aprobadas += n;
    else if (f.estado === "REPORTADA") c.reportadas += n;
    else if (f.estado === "NO_APROBADA") c.devueltas += n;
    else c.pendientes += n;
  }
  return c;
}

export function totalTareas(c: ConteoEstados): number {
  return c.pendientes + c.reportadas + c.aprobadas + c.devueltas;
}

/** Suma de créditos: 2.001 aprobadas + 222 reportadas = 2.001 + 177,6 = 2.178,6. */
export function creditoAcumulado(c: ConteoEstados): number {
  return (
    c.aprobadas * CREDITO_APROBADA +
    c.reportadas * CREDITO_REPORTADA +
    c.devueltas * CREDITO_NO_APROBADA +
    c.pendientes * CREDITO_PENDIENTE
  );
}

/**
 * Avance físico ejecutado, 0–1. `null` si no hay tareas: una fase vacía no
 * está al 0%, es que no hay nada que medir — y devolver 0 la pintaría como una
 * fase atrasada que nadie ha empezado.
 */
export function avanceEjecutado(c: ConteoEstados): number | null {
  const total = totalTareas(c);
  if (total <= 0) return null;
  return creditoAcumulado(c) / total;
}

/**
 * Avance contando SOLO lo aprobado. Es la cifra que el resto de la app ya
 * enseña (`calcularProgreso.porcentajeAprobado`), y se expone aquí para poder
 * cuadrar las dos pantallas: el ejecutado con crédito nunca es menor, y la
 * diferencia es exactamente el 80% de lo reportado sin revisar.
 */
export function avanceAprobado(c: ConteoEstados): number | null {
  const total = totalTareas(c);
  if (total <= 0) return null;
  return c.aprobadas / total;
}

// ─────────────────────────────────────────────────────────────────────────
// La ventana planeada y el avance que tocaba
// ─────────────────────────────────────────────────────────────────────────

/** Días corridos (de calendario) entre dos fechas, a granularidad de día UTC. */
export function diasCorridos(desde: Date, hasta: Date): number {
  return Math.round((aDiaUTC(hasta).getTime() - aDiaUTC(desde).getTime()) / MS_POR_DIA);
}

/**
 * Qué fracción de una ventana planeada debería estar hecha hoy, 0–1.
 *
 * Reparto LINEAL dentro de la ventana: a mitad de la ventana, 50%. Es la curva
 * que usa por defecto todo informe de interventoría cuando no hay una curva S
 * cargada, y es la única que se puede defender sin inventar datos que nadie
 * capturó.
 *
 * Devuelve `null` si falta alguno de los dos extremos o si la ventana está al
 * revés (fin antes que inicio): eso es un dato malo, y un dato malo no se
 * convierte en un porcentaje, se reporta como desconocido.
 *
 * Una ventana de un solo día no divide por cero: es un escalón —0 antes, 100%
 * el día que llega.
 */
export function fraccionProgramada(
  hoy: Date,
  inicio: Date | null | undefined,
  fin: Date | null | undefined,
): number | null {
  if (!inicio || !fin) return null;
  const i = aDiaUTC(inicio).getTime();
  const f = aDiaUTC(fin).getTime();
  if (!Number.isFinite(i) || !Number.isFinite(f) || f < i) return null;

  const h = aDiaUTC(hoy).getTime();
  if (h < i) return 0;
  // El `>=` es el que cubre la ventana de un solo día (inicio === fin) sin
  // dividir por cero: ese día ya cuenta como ventana cumplida.
  if (h >= f) return 1;
  return (h - i) / (f - i);
}

// ─────────────────────────────────────────────────────────────────────────
// La comparación de obra: ejecutado contra programado
// ─────────────────────────────────────────────────────────────────────────

/** Una fase con su ventana planeada y sus tareas ya contadas. */
export interface FasePlaneada {
  id: string;
  nombre: string;
  orden: number;
  inicioPlan: Date | null;
  finPlan: Date | null;
  conteos: ConteoEstados;
}

/**
 * Cuánto del cronograma está realmente cargado. Existe porque un cronograma a
 * medias es la trampa silenciosa de este cálculo: si 9 de 10 fases tienen
 * ventana, el programado se puede calcular sobre esas 9 — pero compararlo
 * contra un ejecutado que incluye las 10 da un SPI inventado.
 */
export interface Cobertura {
  fasesConVentana: number;
  fasesSinVentana: number;
  tareasConVentana: number;
  tareasSinVentana: number;
  /** ¿Toda tarea de la obra cae dentro de una fase con ventana planeada? */
  completa: boolean;
}

export interface ComparacionAvance {
  /** Avance ejecutado de TODA la obra, 0–1. El titular. */
  ejecutado: number | null;
  /** Solo aprobado, 0–1. Para cuadrar con el resto de la app. */
  aprobado: number | null;
  /** Avance que tocaba hoy, 0–1, sobre las fases CON ventana. `null` = no se sabe. */
  programado: number | null;
  /**
   * El ejecutado restringido a las MISMAS tareas sobre las que se calculó el
   * programado. Es el único numerador honesto del SPI: comparar peras con
   * peras cuando el cronograma está a medias.
   */
  ejecutadoComparable: number | null;
  /** ejecutadoComparable / programado. >1 adelantada. `null` = no se puede. */
  spi: number | null;
  cobertura: Cobertura;
  /** Conteos de toda la obra, para no recorrer las fases otra vez. */
  conteos: ConteoEstados;
}

export function compararAvance(fases: FasePlaneada[], hoy: Date): ComparacionAvance {
  const total: ConteoEstados = { ...CONTEO_VACIO };
  const conVentana: ConteoEstados = { ...CONTEO_VACIO };

  let fasesConVentana = 0;
  let fasesSinVentana = 0;
  // Numerador y denominador del programado: la ponderación de cada fase es su
  // número de tareas. No sus días: una fase de 30 días con 20 tareas no pesa
  // más que una de 10 días con 800.
  let programadoPonderado = 0;
  let tareasPonderadas = 0;

  for (const f of fases) {
    const n = totalTareas(f.conteos);
    total.pendientes += f.conteos.pendientes;
    total.reportadas += f.conteos.reportadas;
    total.aprobadas += f.conteos.aprobadas;
    total.devueltas += f.conteos.devueltas;

    const fraccion = fraccionProgramada(hoy, f.inicioPlan, f.finPlan);
    if (fraccion === null) {
      fasesSinVentana++;
      continue;
    }
    fasesConVentana++;
    // Una fase con ventana pero sin tareas no aporta ni al numerador ni al
    // denominador: pesa 0. Cuenta como cronograma cargado, no como avance.
    if (n <= 0) continue;
    programadoPonderado += fraccion * n;
    tareasPonderadas += n;
    conVentana.pendientes += f.conteos.pendientes;
    conVentana.reportadas += f.conteos.reportadas;
    conVentana.aprobadas += f.conteos.aprobadas;
    conVentana.devueltas += f.conteos.devueltas;
  }

  const tareasTotales = totalTareas(total);
  const programado = tareasPonderadas > 0 ? programadoPonderado / tareasPonderadas : null;
  const ejecutadoComparable = avanceEjecutado(conVentana);

  return {
    ejecutado: avanceEjecutado(total),
    aprobado: avanceAprobado(total),
    programado,
    ejecutadoComparable,
    spi: indiceDesempenoPlazo(ejecutadoComparable, programado),
    cobertura: {
      fasesConVentana,
      fasesSinVentana,
      tareasConVentana: tareasPonderadas,
      tareasSinVentana: tareasTotales - tareasPonderadas,
      completa: fasesConVentana > 0 && fasesSinVentana === 0,
    },
    conteos: total,
  };
}

/**
 * SPI (Schedule Performance Index) = ejecutado / programado. Mayor que 1 es
 * obra adelantada.
 *
 * `null` cuando el programado es desconocido —no hay cronograma— y también
 * cuando es CERO: dividir por cero no da «infinitamente adelantada», da una
 * pregunta mal planteada. Antes de que empiece la primera fase no hay contra
 * qué comparar, y la pantalla tiene que decir eso.
 */
export function indiceDesempenoPlazo(
  ejecutado: number | null,
  programado: number | null,
): number | null {
  if (ejecutado === null || programado === null) return null;
  if (programado <= 0) return null;
  return ejecutado / programado;
}

export type Ritmo = "ADELANTADA" | "EN_PLAZO" | "ATRASADA";

/** Traduce el SPI a las tres palabras que el usuario entiende sin explicación. */
export function ritmoDeSPI(spi: number | null): Ritmo | null {
  if (spi === null) return null;
  if (spi >= 1 + TOLERANCIA_SPI) return "ADELANTADA";
  if (spi <= 1 - TOLERANCIA_SPI) return "ATRASADA";
  return "EN_PLAZO";
}

// ─────────────────────────────────────────────────────────────────────────
// Tiempo transcurrido
// ─────────────────────────────────────────────────────────────────────────

export interface TiempoObra {
  /** Días corridos consumidos / plazo total. Puede pasar de 1: el plazo vencido
   *  es información, y recortarlo a 100% escondería justo lo que hay que ver. */
  fraccion: number;
  diasCorridos: number;
  plazoDias: number;
}

/**
 * Tiempo transcurrido en DÍAS CORRIDOS, no hábiles: el plazo de un contrato de
 * obra en Colombia se cuenta en días calendario, y el trío de indicadores tiene
 * que hablar la misma unidad que el contrato.
 *
 * `null` si falta alguna fecha o si el plazo no es positivo.
 */
export function tiempoTranscurrido(
  hoy: Date,
  inicio: Date | null | undefined,
  fin: Date | null | undefined,
): TiempoObra | null {
  if (!inicio || !fin) return null;
  const plazoDias = diasCorridos(inicio, fin);
  if (!Number.isFinite(plazoDias) || plazoDias <= 0) return null;

  const corridos = Math.max(0, diasCorridos(inicio, hoy));
  return { fraccion: corridos / plazoDias, diasCorridos: corridos, plazoDias };
}

// ─────────────────────────────────────────────────────────────────────────
// Estado de una fase
// ─────────────────────────────────────────────────────────────────────────

/**
 * `SIN_MEDIDA` cubre los dos casos en los que NO se puede juzgar una fase: sin
 * ventana planeada y sin tareas. Se juntan a propósito en un solo estado — lo
 * que el usuario necesita saber es que ahí no hay veredicto; el motivo exacto
 * lo dice el detalle.
 */
export type EstadoFase = "CERRADA" | "ATRASADA" | "EN_CURSO" | "SIN_EMPEZAR" | "SIN_MEDIDA";

export function estadoDeFase(
  conteos: ConteoEstados,
  ejecutado: number | null,
  programado: number | null,
): EstadoFase {
  const total = totalTareas(conteos);
  if (total > 0 && conteos.aprobadas === total) return "CERRADA";
  if (ejecutado === null || programado === null) return "SIN_MEDIDA";
  if (ejecutado === 0 && programado === 0) return "SIN_EMPEZAR";
  if (ejecutado * 100 < programado * 100 - TOLERANCIA_ATRASO_PUNTOS) return "ATRASADA";
  return "EN_CURSO";
}

/** Diferencia ejecutado − programado en PUNTOS porcentuales, con un decimal. */
export function diferenciaPuntos(
  ejecutado: number | null,
  programado: number | null,
): number | null {
  if (ejecutado === null || programado === null) return null;
  return Math.round((ejecutado - programado) * 1000) / 10;
}

// ─────────────────────────────────────────────────────────────────────────
// Formato
// ─────────────────────────────────────────────────────────────────────────

/** 0,4868 → "49%". `null` nunca se formatea: quien llama decide qué decir. */
export function formatearPorcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)}%`;
}

/** 1,0812 → "1,08". Coma decimal: el informe se lee en Colombia. */
export function formatearSPI(spi: number): string {
  return spi.toFixed(2).replace(".", ",");
}

/** 4110 → "4.110". Punto de miles, que es como se escribe en Colombia. */
export function formatearMiles(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** −4,3 → "−4,3 pts"; 0 → "igual al plan". */
export function formatearPuntos(puntos: number): string {
  if (puntos === 0) return "igual al plan";
  const signo = puntos > 0 ? "+" : "−";
  return `${signo}${Math.abs(puntos).toFixed(1).replace(".", ",")} pts`;
}
