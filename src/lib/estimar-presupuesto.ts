// ─────────────────────────────────────────────────────────────────────────
// Motor de estimación de presupuesto (B2C: propietario / contratista).
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
  factorRegional,
  pctManoObraDeTarea,
  PCT_MANO_OBRA_DEFAULT,
  type PrecioSemilla,
} from "./precios-semilla";

export interface TareaEstim {
  nombre: string;
  dias: number;
  /** Solo se estiman las tareas activas (pendientes). */
  on: boolean;
  /**
   * Fase curada de la tarea si el llamador ya la conoce (p. ej. import del
   * Excel único). Opcional: el motor de duración usa `faseDeTarea(nombre)`
   * como fallback determinista.
   */
  fase?: string;
  /**
   * Id de la tarea en el sistema del llamador (`Tarea.id`). Solo hace falta
   * cuando se quieren pasar dependencias explícitas: es el valor al que
   * apunta el `dependeDe` de otra tarea. El estimador de COSTOS lo ignora.
   */
  id?: string;
  /**
   * `Tarea.depende_de`: id de la tarea que tiene que terminar antes que esta.
   * El motor de duración lo convierte en una arista del grafo del cronograma
   * y RECHAZA la que cierre un ciclo. El estimador de costos lo ignora.
   */
  dependeDe?: string;
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
  /** Porción de mano de obra del costo (= costo × pctManoObra). */
  manoObra: number;
  /** Porción de materiales del costo (= costo × (1 − pctManoObra)). */
  materiales: number;
  /** Fracción 0–1 de mano de obra aplicada a esta tarea. */
  pctManoObra: number;
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
  /** Total de mano de obra de toda la obra (suma de tareas). */
  totalManoObra: number;
  /** Total de materiales de toda la obra (suma de tareas). */
  totalMateriales: number;
  espacios: EstimEspacio[];
  /** Fracción de tareas activas que tuvieron precio semilla (0–1). */
  cobertura: number;
  /** # de tareas activas sin dato confiable (estimadas con fallback). */
  sinDato: number;
}

/** Separa un costo total en mano de obra / materiales según pctManoObra (0–1). */
export function dividirCosto(
  costo: number,
  pctManoObra: number,
): { manoObra: number; materiales: number } {
  const pct = Number.isFinite(pctManoObra) ? Math.min(1, Math.max(0, pctManoObra)) : PCT_MANO_OBRA_DEFAULT;
  const manoObra = Math.round(costo * pct);
  // Materiales por diferencia: garantiza manoObra + materiales === costo.
  return { manoObra, materiales: Math.round(costo) - manoObra };
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

/** Área típica (m² de piso) de un espacio por su nombre, si no dio metraje. */
export function areaTipica(nombreEspacio: string): number {
  const n = nombreEspacio.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [k, v] of Object.entries(AREA_TIPICA_M2)) {
    if (n.includes(k)) return v;
  }
  return 12; // genérico
}

/**
 * Cantidad estimada para una clave/unidad en un espacio (m², ml o unidades).
 * Compartida por el estimador de COSTOS y el motor de DURACIÓN
 * (estimar-duracion.ts): misma lógica de cantidades, una sola definición.
 *  - m2 de PARED (KEYS_PARED): área de piso × FACTOR_PARED.
 *  - m2 de piso: el metraje del espacio (o su área típica).
 *  - ml: default por clave (closet/muebles de cocina) o 3 ml.
 *  - unidad/global: 1 por espacio (el usuario ajusta).
 */
export function cantidadPorUnidad(
  key: string,
  unidad: PrecioSemilla["unidad"],
  espacio: EspacioEstim,
): number {
  const areaPiso =
    espacio.metraje && espacio.metraje > 0 ? espacio.metraje : areaTipica(espacio.nombre);
  switch (unidad) {
    case "m2":
      return KEYS_PARED.has(key) ? Math.round(areaPiso * FACTOR_PARED) : areaPiso;
    case "ml":
      return ML_DEFECTO[key] ?? 3;
    case "unidad":
      return 1; // 1 por espacio por defecto (1 puerta, 1 sanitario…); el usuario ajusta
    case "global":
      return 1;
  }
}

/** Cantidad estimada (en la unidad del precio) para una tarea en un espacio. */
function cantidadEstim(p: PrecioSemilla, espacio: EspacioEstim): number {
  return cantidadPorUnidad(p.key, p.unidad, espacio);
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
export function distribuirAreaTotal(
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
  const mult = factorRegional(opts.ciudad);
  // Si el usuario dio el área de toda la obra, repártela entre los espacios sin
  // metraje propio antes de estimar (modo "Área de toda la obra").
  const espacios =
    opts.areaTotal && opts.areaTotal > 0
      ? distribuirAreaTotal(espaciosEntrada, opts.areaTotal)
      : espaciosEntrada;
  let total = 0;
  let min = 0;
  let max = 0;
  let totalManoObra = 0;
  let totalMateriales = 0;
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
        const { manoObra, materiales } = dividirCosto(base, p.pctManoObra);
        costoEsp += base;
        min += lo;
        max += hi;
        total += base;
        totalManoObra += manoObra;
        totalMateriales += materiales;
        tareasOut.push({
          nombre: t.nombre,
          costo: base,
          min: lo,
          max: hi,
          manoObra,
          materiales,
          pctManoObra: p.pctManoObra,
          conDato: true,
        });
      } else {
        // Fallback: sin dato semilla. Estimamos por día de trabajo (~$80k/día M.O.),
        // marcado conDato:false para poder señalarlo como menos confiable.
        const fallback = Math.round((t.dias || 1) * 80000 * mult);
        const pct = PCT_MANO_OBRA_DEFAULT;
        const { manoObra, materiales } = dividirCosto(fallback, pct);
        costoEsp += fallback;
        min += Math.round(fallback * 0.6);
        max += Math.round(fallback * 1.6);
        total += fallback;
        totalManoObra += manoObra;
        totalMateriales += materiales;
        tareasOut.push({
          nombre: t.nombre,
          costo: fallback,
          min: Math.round(fallback * 0.6),
          max: Math.round(fallback * 1.6),
          manoObra,
          materiales,
          pctManoObra: pct,
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
    totalManoObra,
    totalMateriales,
    espacios: out,
    cobertura: activas === 0 ? 0 : conDato / activas,
    sinDato: activas - conDato,
  };
}

/** # de tareas en la semilla — útil para mostrar "basado en N precios de referencia". */
export const TOTAL_PRECIOS_SEMILLA = PRECIOS_SEMILLA.length;

// ─────────────────────────────────────────────────────────────────────────
// REPARTO DE PRESUPUESTO — 3 modos (funciones PURAS, deterministas).
//
// El "peso inteligente" de cada tarea sale de su COSTO ESTIMADO (del estimador
// IA o del determinista, ambos basados en el modelo verificado). Por eso el
// reparto NO es parejo: una cocina pesa más que un baño. Si no hay estimado, se
// cae a un peso uniforme para no dividir por cero.
// ─────────────────────────────────────────────────────────────────────────

/** Entrada de reparto por tarea: índice, costo estimado (peso) y % mano de obra. */
export interface TareaReparto {
  i: number;
  /** Costo total estimado de la tarea (IA o determinista). Es el peso. */
  estimado: number;
  /** Fracción 0–1 de mano de obra de la tarea (de la base semilla). */
  pctManoObra: number;
}

/** Salida de reparto por tarea. */
export interface MontoReparto {
  i: number;
  costo: number;
  manoObra: number;
  materiales: number;
}

/** Agregados de un reparto (totales que deben cuadrar con las bolsas dadas). */
export interface ResultadoReparto {
  porTarea: MontoReparto[];
  totalCosto: number;
  totalManoObra: number;
  totalMateriales: number;
}

/** Suma segura. */
function suma(ns: number[]): number {
  return ns.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/**
 * Reparte una BOLSA (entero COP) entre ítems ponderado por `pesos`, con el
 * último ítem absorbiendo el redondeo para que la suma sea EXACTA. Si todos los
 * pesos son 0, reparte en partes iguales (último absorbe el resto).
 */
function repartirPonderado(bolsa: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const total = Math.max(0, Math.round(bolsa));
  const sumaPesos = suma(pesos);
  const usaUniforme = sumaPesos <= 0;
  const out = new Array<number>(n).fill(0);
  let asignado = 0;
  for (let k = 0; k < n - 1; k++) {
    const frac = usaUniforme ? 1 / n : pesos[k] / sumaPesos;
    const v = Math.round(total * frac);
    out[k] = v;
    asignado += v;
  }
  out[n - 1] = total - asignado; // el último absorbe el redondeo (suma exacta)
  return out;
}

/**
 * MODO "ninguno" (sin presupuesto): NO hay bolsa; cada tarea conserva su costo
 * estimado y se separa en M.O./materiales por su pctManoObra.
 */
export function repartoSinPresupuesto(tareas: TareaReparto[]): ResultadoReparto {
  const porTarea = tareas.map((t) => {
    const costo = Math.max(0, Math.round(t.estimado));
    const { manoObra, materiales } = dividirCosto(costo, t.pctManoObra);
    return { i: t.i, costo, manoObra, materiales };
  });
  return agregarReparto(porTarea);
}

/**
 * MODO "general" (un total): reparte `total` entre tareas PONDERADO por su costo
 * estimado (peso real, NO partes iguales). Cada monto se separa en M.O./mater.
 */
export function repartoGeneral(total: number, tareas: TareaReparto[]): ResultadoReparto {
  const pesos = tareas.map((t) => Math.max(0, t.estimado));
  const montos = repartirPonderado(total, pesos);
  const porTarea = tareas.map((t, k) => {
    const costo = montos[k];
    const { manoObra, materiales } = dividirCosto(costo, t.pctManoObra);
    return { i: t.i, costo, manoObra, materiales };
  });
  return agregarReparto(porTarea);
}

/**
 * MODO "separado" (M.O. + materiales aparte): reparte la bolsa de MANO DE OBRA
 * entre tareas ponderado por su porción de M.O. estimada (estimado × pct), y la
 * de MATERIALES ponderado por su porción de materiales estimada (estimado ×
 * (1−pct)). El costo de cada tarea = su M.O. asignada + sus materiales asignados.
 */
export function repartoSeparado(
  bolsaManoObra: number,
  bolsaMateriales: number,
  tareas: TareaReparto[],
): ResultadoReparto {
  const pesosMO = tareas.map((t) => Math.max(0, t.estimado) * clampPct(t.pctManoObra));
  const pesosMat = tareas.map((t) => Math.max(0, t.estimado) * (1 - clampPct(t.pctManoObra)));
  const moAsig = repartirPonderado(bolsaManoObra, pesosMO);
  const matAsig = repartirPonderado(bolsaMateriales, pesosMat);
  const porTarea = tareas.map((t, k) => ({
    i: t.i,
    costo: moAsig[k] + matAsig[k],
    manoObra: moAsig[k],
    materiales: matAsig[k],
  }));
  return agregarReparto(porTarea);
}

function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return PCT_MANO_OBRA_DEFAULT;
  return Math.min(1, Math.max(0, pct));
}

function agregarReparto(porTarea: MontoReparto[]): ResultadoReparto {
  return {
    porTarea,
    totalCosto: suma(porTarea.map((p) => p.costo)),
    totalManoObra: suma(porTarea.map((p) => p.manoObra)),
    totalMateriales: suma(porTarea.map((p) => p.materiales)),
  };
}

// Referencia explícita para mantener disponibles los helpers de % M.O. que el
// resto del módulo (y el API) usa al construir los TareaReparto desde nombres.
export { pctManoObraDeTarea };
