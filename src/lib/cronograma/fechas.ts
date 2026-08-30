// ─────────────────────────────────────────────────────────────────────────
// De DÍAS a FECHAS. La frontera entre el motor y lo que lee el usuario.
//
// ══ POR QUÉ ESTO ES UN ARREGLO Y NO UN ADORNO ══════════════════════════════
//
// El motor cuenta en días HÁBILES. La interfaz decía «~62 días hábiles», y ahí
// empezaba el problema: el usuario cuenta 62 días en el calendario del
// teléfono, cae dos semanas antes de lo que el motor quiso decir, y la app
// queda mintiendo sin haberse equivocado en nada. La ambigüedad
// hábiles/calendario no se arregla con una nota al pie: se arregla no
// enseñando NUNCA un conteo de días. Se enseña una FECHA — y una fecha no
// admite dos lecturas.
//
// Aquí es donde el módulo de cronograma toca el calendario colombiano
// (`calendario-colombia.ts`, también puro y determinista): sus 18 festivos y
// la semana de seis días son parte de la respuesta, no un detalle de
// presentación. Una casa de 116 días hábiles que arranca en octubre atraviesa
// cinco festivos; sin ellos la fecha se corre casi una semana.
// ─────────────────────────────────────────────────────────────────────────

import {
  aDiaUTC,
  addWorkingDays,
  DIAS_HABILES_SEMANA_DEFECTO,
  diasHabilesEntre,
} from "../calendario-colombia";
import { probabilidadHasta, type DistribucionDuracion } from "./probabilidad";

export interface OpcionesPronostico {
  /** Día en que arranca la obra. */
  inicio: Date;
  /** Jornada del proyecto (`dias_habiles_semana`). Por defecto 6 (Lu–Sá). */
  diasHabilesSemana?: number;
}

export interface PronosticoFechas {
  inicio: Date;
  diasHabilesSemana: number;
  /** La fecha «lo más probable»: mediana de la distribución. */
  fechaP50: Date;
  /** La fecha que se cumple en 8 de cada 10 obras parecidas. */
  fechaP80: Date;
  /** La fecha casi segura (95%). Para comprometerse con multa. */
  fechaP95: Date;
  /**
   * P(terminar en o antes de `fecha`), 0–1. Monótona: una fecha posterior
   * nunca es menos probable.
   */
  probabilidadFecha(fecha: Date): number;
}

/**
 * Traduce la distribución a fechas. Los percentiles se REDONDEAN HACIA ARRIBA
 * antes de convertirse: prometer el día 62.3 es prometer el 63, no el 62 —
 * hacia abajo la promesa se incumpliría por construcción.
 */
export function pronosticoFechas(
  d: DistribucionDuracion,
  opts: OpcionesPronostico,
): PronosticoFechas {
  const diasSemana = opts.diasHabilesSemana ?? DIAS_HABILES_SEMANA_DEFECTO;
  const fechaDe = (dias: number): Date =>
    addWorkingDays(opts.inicio, Math.max(1, Math.ceil(dias)), diasSemana);

  return {
    inicio: opts.inicio,
    diasHabilesSemana: diasSemana,
    fechaP50: fechaDe(d.p50),
    fechaP80: fechaDe(d.p80),
    fechaP95: fechaDe(d.p95),
    probabilidadFecha(fecha: Date): number {
      return probabilidadHasta(d, diasHabilesEntre(opts.inicio, fecha, diasSemana));
    },
  };
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * «14 de octubre» — y «14 de octubre de 2027» si el año no es el de la fecha
 * de referencia, para que una obra larga no prometa un mes sin decir cuál.
 *
 * Sin `Intl`: el formato tiene que salir igual en el servidor y en el
 * navegador, y los datos de locale no están garantizados en todos los runtimes.
 */
export function fechaLarga(fecha: Date, referencia?: Date): string {
  const dia = fecha.getUTCDate();
  const mes = MESES[fecha.getUTCMonth()];
  const anio = fecha.getUTCFullYear();
  const mismoAnio = referencia ? referencia.getUTCFullYear() === anio : false;
  return mismoAnio ? `${dia} de ${mes}` : `${dia} de ${mes} de ${anio}`;
}

/** «18 sep» — para las etiquetas apretadas de la línea de tiempo. */
export function fechaCorta(fecha: Date): string {
  return `${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()].slice(0, 3)}`;
}

/**
 * Normaliza lo que llega de la base de datos o de un `<input type="date">` a
 * medianoche UTC. Devuelve `null` si no hay fecha o si no se puede leer — el
 * llamador decide qué enseñar entonces, en vez de recibir un `Invalid Date`
 * que envenene todas las cuentas de abajo.
 */
export function fechaUTCDesde(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (!Number.isFinite(d.getTime())) return null;
  return aDiaUTC(d);
}
