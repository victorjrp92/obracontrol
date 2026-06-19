// ─────────────────────────────────────────────────────────────────────────
// Motor de estimación de presupuesto (B2C: propietario / arquitecto).
//
// DETERMINISTA: a partir de los espacios + tareas activas, calcula un costo
// sugerido usando la base semilla de precios (precios-semilla.ts). NO necesita
// IA ni API key — funciona solo. La capa DeepSeek se monta ENCIMA de esto:
// afina el match tarea↔precio y rellena lo que la semilla no cubre, pero el
// fallback siempre es este cálculo.
//
// La estimación es un PUNTO DE PARTIDA, no una cotización. Por eso devolvemos
// rango (min–max) y cobertura (qué fracción de tareas tuvo dato real), para
// poder mostrar "es un estimado, ajústalo" con honestidad.
// ─────────────────────────────────────────────────────────────────────────

import {
  PRECIOS_SEMILLA,
  buscarPrecioSemilla,
  multiplicadorCiudad,
  type PrecioSemilla,
} from "./precios-semilla";

export interface TareaEstim {
  nombre: string;
  dias: number;
  /** Solo se estiman las tareas activas (pendientes). */
  on: boolean;
}

export interface EspacioEstim {
  id: string;
  nombre: string;
  /** m² del espacio (área de piso). Opcional. */
  metraje?: number;
  tareas: TareaEstim[];
}

export interface EstimTarea {
  nombre: string;
  costo: number;
  min: number;
  max: number;
  /** true si vino de la base semilla; false si es un fallback genérico. */
  conDato: boolean;
}

export interface EstimEspacio {
  id: string;
  costo: number;
  /** En orden de las tareas ACTIVAS del espacio. */
  tareas: EstimTarea[];
}

export interface ResultadoEstim {
  total: number;
  min: number;
  max: number;
  espacios: EstimEspacio[];
  /** Fracción de tareas activas que tuvieron precio semilla (0–1). */
  cobertura: number;
  /** # de tareas activas sin dato confiable (estimadas con fallback). */
  sinDato: number;
}

// Área típica de piso por tipo de espacio (m²), cuando el usuario no la da.
// Valores conservadores para vivienda colombiana promedio.
const AREA_TIPICA_M2: Record<string, number> = {
  bano: 5, baño: 5, cocina: 9, habitacion: 12, "habitación": 12, alcoba: 12,
  cuarto: 12, sala: 18, comedor: 12, "salacomedor": 26, estudio: 10,
  oficina: 12, garaje: 15, parqueadero: 15, lavanderia: 4, "lavandería": 4,
  balcon: 5, "balcón": 5, terraza: 12, pasillo: 6, hall: 6, vestier: 4,
  fachada: 35, local: 40, deposito: 6, "depósito": 6,
};

// Factor para pasar de área de PISO a área de PARED (perímetro × altura).
// Vivienda con altura ~2.4 m: área de muros ≈ 2.4× el área de piso.
const FACTOR_PARED = 2.4;

// Tareas que se miden sobre área de PARED (no de piso).
const KEYS_PARED = new Set([
  "estuco_pared", "estuco_techo", "sellador", "pintura_base", "pintura_final",
  "enchape_pared", "panete", "mamposteria", "resane",
]);

// Cantidad lineal (ml) por defecto para tareas de carpintería sin medida.
const ML_DEFECTO: Record<string, number> = {
  closet: 3, mueble_bajo_cocina: 4, mueble_alto_cocina: 4,
};

function areaTipica(nombreEspacio: string): number {
  const n = nombreEspacio.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [k, v] of Object.entries(AREA_TIPICA_M2)) {
    if (n.includes(k)) return v;
  }
  return 12; // genérico
}

/** Cantidad estimada (en la unidad del precio) para una tarea en un espacio. */
function cantidadEstim(p: PrecioSemilla, espacio: EspacioEstim): number {
  const areaPiso = espacio.metraje && espacio.metraje > 0 ? espacio.metraje : areaTipica(espacio.nombre);
  switch (p.unidad) {
    case "m2":
      return KEYS_PARED.has(p.key) ? Math.round(areaPiso * FACTOR_PARED) : areaPiso;
    case "ml":
      return ML_DEFECTO[p.key] ?? 3;
    case "unidad":
      return 1; // 1 por espacio por defecto (1 puerta, 1 sanitario…); el usuario ajusta
    case "global":
      return 1;
  }
}

export interface EstimOpts {
  ciudad?: string | null;
  /** Si true, usa el extremo bajo del rango (estimado conservador). */
  conservador?: boolean;
  /**
   * Área total de la obra (m²) cuando el usuario la dio "de toda la obra" en vez
   * de espacio por espacio. Si viene, se reparte entre los espacios que aún no
   * traen `metraje` propio, ponderado por su área típica, antes de estimar.
   */
  areaTotal?: number;
}

/**
 * Reparte `areaTotal` (m²) entre los espacios SIN metraje propio, ponderado por
 * su área típica. Devuelve una copia de los espacios con `metraje` rellenado.
 * Los espacios que ya traen `metraje > 0` se respetan tal cual; el área total se
 * distribuye solo sobre el remanente. Esto permite que "Sugerir presupuesto"
 * use el m² total que dio el usuario sin perder la granularidad que ya exista.
 */
function distribuirAreaTotal(
  espacios: EspacioEstim[],
  areaTotal: number,
): EspacioEstim[] {
  if (!Number.isFinite(areaTotal) || areaTotal <= 0) return espacios;

  // Solo cuentan los espacios con tareas activas (los que se van a estimar).
  const sinMetraje = espacios.filter(
    (e) => !(e.metraje && e.metraje > 0) && e.tareas.some((t) => t.on),
  );
  if (sinMetraje.length === 0) return espacios;

  const yaAsignada = espacios.reduce(
    (acc, e) => acc + (e.metraje && e.metraje > 0 ? e.metraje : 0),
    0,
  );
  const restante = Math.max(0, areaTotal - yaAsignada);
  if (restante <= 0) return espacios;

  const pesos = sinMetraje.map((e) => areaTipica(e.nombre));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0) || sinMetraje.length;

  const areaPorId = new Map<string, number>();
  sinMetraje.forEach((e, i) => {
    areaPorId.set(e.id, (restante * pesos[i]) / sumaPesos);
  });

  return espacios.map((e) =>
    areaPorId.has(e.id) ? { ...e, metraje: areaPorId.get(e.id) } : e,
  );
}

/**
 * Estima el presupuesto a partir de los espacios y sus tareas activas.
 * Determinista y puro: mismas entradas → mismas salidas.
 */
export function estimarPresupuesto(
  espaciosEntrada: EspacioEstim[],
  opts: EstimOpts = {},
): ResultadoEstim {
  const mult = multiplicadorCiudad(opts.ciudad);
  // Si el usuario dio el área de toda la obra, repártela entre los espacios sin
  // metraje propio antes de estimar (modo "Área de toda la obra").
  const espacios =
    opts.areaTotal && opts.areaTotal > 0
      ? distribuirAreaTotal(espaciosEntrada, opts.areaTotal)
      : espaciosEntrada;
  let total = 0;
  let min = 0;
  let max = 0;
  let activas = 0;
  let conDato = 0;

  const out: EstimEspacio[] = espacios.map((esp) => {
    const tareasOut: EstimTarea[] = [];
    let costoEsp = 0;
    for (const t of esp.tareas) {
      if (!t.on) continue;
      activas++;
      const p = buscarPrecioSemilla(t.nombre);
      if (p) {
        conDato++;
        const q = cantidadEstim(p, esp);
        const base = Math.round((opts.conservador ? p.minCOP : p.medianoCOP) * q * mult);
        const lo = Math.round(p.minCOP * q * mult);
        const hi = Math.round(p.maxCOP * q * mult);
        costoEsp += base;
        min += lo;
        max += hi;
        total += base;
        tareasOut.push({ nombre: t.nombre, costo: base, min: lo, max: hi, conDato: true });
      } else {
        // Fallback: sin dato semilla. Estimamos por día de trabajo (~$80k/día M.O.),
        // marcado conDato:false para poder señalarlo como menos confiable.
        const fallback = Math.round((t.dias || 1) * 80000 * mult);
        costoEsp += fallback;
        min += Math.round(fallback * 0.6);
        max += Math.round(fallback * 1.6);
        total += fallback;
        tareasOut.push({
          nombre: t.nombre,
          costo: fallback,
          min: Math.round(fallback * 0.6),
          max: Math.round(fallback * 1.6),
          conDato: false,
        });
      }
    }
    return { id: esp.id, costo: costoEsp, tareas: tareasOut };
  });

  return {
    total,
    min,
    max,
    espacios: out,
    cobertura: activas === 0 ? 0 : conDato / activas,
    sinDato: activas - conDato,
  };
}

/** # de tareas en la semilla — útil para mostrar "basado en N precios de referencia". */
export const TOTAL_PRECIOS_SEMILLA = PRECIOS_SEMILLA.length;
