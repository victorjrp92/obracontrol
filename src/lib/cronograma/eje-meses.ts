// ─────────────────────────────────────────────────────────────────────────
// EL EJE DE CALENDARIO de la línea de tiempo.
//
// Las barras se dibujan en días HÁBILES (es lo que cuenta el motor) pero el
// usuario lee MESES. La conversión no es lineal: en la escala de días hábiles
// un mes con dos festivos ocupa menos ancho que uno sin ninguno, y ese
// estrujamiento es correcto —hay menos obra dentro—. Por eso el eje no se
// puede dibujar con cuatro celdas iguales: hay que preguntarle al calendario
// dónde cae cada frontera de mes.
//
// La posición `d` del eje significa EXACTAMENTE lo mismo que en las barras:
// `addWorkingDays(inicio, d)`. Esa igualdad es el contrato — si se rompe, el
// eje miente sobre las barras que tiene debajo, que es peor que no tener eje.
// Por eso `fechas` se construye con la misma convención de `addWorkingDays`
// (d = 0 es el propio día de arranque) en lugar de reimplementarla.
// ─────────────────────────────────────────────────────────────────────────

import { aDiaUTC, DIAS_HABILES_SEMANA_DEFECTO, esHabil } from "../calendario-colombia";

/** Tope de seguridad: ~8 años de obra. Nadie dibuja un eje más largo. */
const MAX_DIAS = 2600;

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** Un mes del calendario, ubicado en la escala de días hábiles. */
export interface SegmentoMes {
  anio: number;
  /** 0–11. */
  mes: number;
  /** "sep". */
  etiqueta: string;
  /** "septiembre". */
  etiquetaLarga: string;
  /** Primer índice de día hábil que cae en este mes. */
  desde: number;
  /** Índice siguiente al último del mes (exclusivo). */
  hasta: number;
  /** Fracción 0–100 del eje donde empieza. */
  desdePct: number;
  /** Ancho en fracción 0–100 del eje. */
  anchoPct: number;
}

export interface EjeCalendario {
  /** Fecha de cada día hábil, indexada por posición del eje. */
  fechas: Date[];
  meses: SegmentoMes[];
  /** Días hábiles que abarca el eje (el denominador de los porcentajes). */
  escala: number;
}

const VACIO: EjeCalendario = { fechas: [], meses: [], escala: 0 };

/**
 * Construye el eje de meses para una obra que arranca en `inicio` y dura
 * `escalaDias` días hábiles.
 *
 * Devuelve `escala` saneada: quien dibuje debe usar ESTA y no la que pasó,
 * porque un `escalaDias` fraccionario se redondea hacia arriba para que el
 * último día quepa entero en el eje.
 */
export function ejeDeMeses(
  inicio: Date,
  escalaDias: number,
  diasHabilesSemana: number = DIAS_HABILES_SEMANA_DEFECTO,
): EjeCalendario {
  if (!(inicio instanceof Date) || !Number.isFinite(inicio.getTime())) return VACIO;
  if (!Number.isFinite(escalaDias) || escalaDias <= 0) return VACIO;

  const escala = Math.min(Math.ceil(escalaDias), MAX_DIAS);

  // Misma convención que `addWorkingDays`: d = 0 es el día de arranque (sea
  // hábil o no) y de ahí en adelante se cuenta el siguiente hábil.
  const fechas: Date[] = [aDiaUTC(inicio)];
  let cursor = fechas[0];
  let guardia = 0;
  while (fechas.length <= escala && guardia++ < MAX_DIAS * 3) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (esHabil(cursor, diasHabilesSemana)) fechas.push(cursor);
  }

  const meses: SegmentoMes[] = [];
  for (let d = 0; d < fechas.length; d++) {
    const f = fechas[d];
    const anio = f.getUTCFullYear();
    const mes = f.getUTCMonth();
    const ultimo = meses[meses.length - 1];
    if (ultimo && ultimo.anio === anio && ultimo.mes === mes) {
      ultimo.hasta = d + 1;
    } else {
      meses.push({
        anio,
        mes,
        etiqueta: MESES_CORTOS[mes],
        etiquetaLarga: MESES_LARGOS[mes],
        desde: d,
        hasta: d + 1,
        desdePct: 0,
        anchoPct: 0,
      });
    }
  }

  // El denominador es `escala`, no `fechas.length`: las barras se posicionan
  // con `dia / escala`, así que el eje tiene que dividir por lo mismo o los
  // meses quedan corridos respecto de lo que rotulan.
  // `fechas` tiene escala + 1 días (del 0 al escala, ambos incluidos), así que
  // el último mes se saldría del marco un día entero. El INICIO nunca se toca
  // —es el contrato con las barras— pero el ancho del último se recorta al
  // borde: un eje que pinta fuera de su caja empuja el scroll horizontal de la
  // página y deja el rótulo del mes colgando en el vacío.
  for (const m of meses) {
    m.desdePct = (m.desde / escala) * 100;
    m.anchoPct = ((Math.min(m.hasta, escala) - m.desde) / escala) * 100;
  }

  return { fechas, meses, escala };
}

/**
 * Posición 0–100 de una fecha del calendario dentro del eje, o `null` si cae
 * fuera del tramo dibujado. Se busca sobre `fechas` en vez de contar días
 * hábiles aparte, para que el marcador caiga en el MISMO sitio que caería una
 * barra que terminara ese día.
 */
export function posicionDeFecha(eje: EjeCalendario, fecha: Date): number | null {
  if (eje.escala <= 0 || eje.fechas.length === 0) return null;
  if (!(fecha instanceof Date) || !Number.isFinite(fecha.getTime())) return null;

  const t = aDiaUTC(fecha).getTime();
  if (t < eje.fechas[0].getTime()) return null;
  if (t > eje.fechas[eje.fechas.length - 1].getTime()) return null;

  // Último índice cuya fecha no pasa de `t`. Binaria: el eje puede tener
  // cientos de días y esto se llama en cada render.
  let lo = 0;
  let hi = eje.fechas.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (eje.fechas[mid].getTime() <= t) lo = mid;
    else hi = mid - 1;
  }
  return (lo / eje.escala) * 100;
}
