// ─────────────────────────────────────────────────────────────────────────
// Base de datos SEMILLA de RENDIMIENTOS de construcción Colombia (2026).
// Fuente: investigación con triangulación de fuentes colombianas (Construdata,
// CYPE Generador de Precios, APUs ICCU/gov.co, literatura de rendimientos de
// mano de obra en Colombia). Verificado contra duraciones típicas de obra.
//
// USO: semilla para el motor de duración (estimar-duracion.ts). Igual patrón
// que precios-semilla → RegistroPrecio: estos números son el punto de partida
// y el flywheel de duraciones (RegistroDuracion, duraciones-mercado.ts) los
// corrige con las duraciones reales de las obras.
//
// CONVENCIÓN: rendimiento por DÍA por CUADRILLA TÍPICA (1 oficial + 1
// ayudante). Las claves coinciden con las de precios-semilla.ts para poder
// cruzar tarea → precio → rendimiento con un solo matcher
// (buscarPrecioSemilla). `demolicion` y `aseo` no existen en la semilla de
// precios: traen sus propios términos de matching (`match`).
//
// PINTURA / SELLADOR son POR MANO (una pasada). Manos por defecto:
//  - pintura base:  1 mano
//  - pintura final: 2 manos (estándar de acabado en vivienda)
//  - sellador:      1 mano
// El motor multiplica la cantidad por las manos antes de dividir por el
// rendimiento.
// ─────────────────────────────────────────────────────────────────────────

export type ConfianzaRendimiento = "alta" | "media" | "media-baja" | "baja";
export type UnidadRendimiento = "m2" | "ml" | "unidad";

export interface Rendimiento {
  /** Clave normalizada; coincide con la key de precios-semilla cuando existe. */
  key: string;
  label: string;
  unidad: UnidadRendimiento;
  /** Rendimiento POR DÍA por cuadrilla (1 oficial + 1 ayudante). */
  porDia: number;
  /** Rango investigado (min = cuadrilla lenta, max = cuadrilla rápida). */
  min: number;
  max: number;
  confianza: ConfianzaRendimiento;
  /** true → el rendimiento es POR MANO (pintura/sellador). */
  porMano?: boolean;
  /** Manos por defecto cuando `porMano` (ver convención arriba). */
  manosDefault?: number;
  /** Términos de matching propios (solo claves SIN entrada en precios-semilla). */
  match?: string[];
  nota?: string;
}

export const RENDIMIENTOS: Record<string, Rendimiento> = {
  // ── Obra blanca / acabados ────────────────────────────────────────────────
  estuco_pared: { key: "estuco_pared", label: "Estuco de paredes", unidad: "m2", porDia: 28, min: 25, max: 35, confianza: "alta" },
  estuco_techo: { key: "estuco_techo", label: "Estuco de techo", unidad: "m2", porDia: 18, min: 15, max: 22, confianza: "media" },
  pintura_base: { key: "pintura_base", label: "Pintura base (por mano)", unidad: "m2", porDia: 45, min: 35, max: 50, confianza: "alta", porMano: true, manosDefault: 1 },
  pintura_final: { key: "pintura_final", label: "Pintura final / vinilo (por mano)", unidad: "m2", porDia: 38, min: 30, max: 45, confianza: "alta", porMano: true, manosDefault: 2 },
  sellador: { key: "sellador", label: "Sellador (por mano)", unidad: "m2", porDia: 60, min: 50, max: 80, confianza: "media-baja", porMano: true, manosDefault: 1 },
  enchape_piso: { key: "enchape_piso", label: "Enchape / cerámica de piso", unidad: "m2", porDia: 10, min: 8, max: 12, confianza: "alta" },
  enchape_pared: { key: "enchape_pared", label: "Enchape de pared", unidad: "m2", porDia: 8, min: 7, max: 10, confianza: "alta" },
  porcelanato: { key: "porcelanato", label: "Porcelanato", unidad: "m2", porDia: 8, min: 7, max: 10, confianza: "alta" },
  resane: { key: "resane", label: "Resane", unidad: "m2", porDia: 40, min: 30, max: 50, confianza: "baja" },

  // ── Obra gris ─────────────────────────────────────────────────────────────
  panete: { key: "panete", label: "Pañete / revoque", unidad: "m2", porDia: 16, min: 14, max: 22, confianza: "alta" },
  mamposteria: { key: "mamposteria", label: "Mampostería / muro", unidad: "m2", porDia: 11, min: 8, max: 14, confianza: "alta" },
  placa: { key: "placa", label: "Placa / estructura", unidad: "m2", porDia: 15, min: 10, max: 20, confianza: "media-baja" },
  pulida_piso: { key: "pulida_piso", label: "Pulida / alisado de piso", unidad: "m2", porDia: 15, min: 12, max: 25, confianza: "media" },

  // ── Instalaciones ─────────────────────────────────────────────────────────
  punto_electrico: { key: "punto_electrico", label: "Punto eléctrico", unidad: "unidad", porDia: 6, min: 4, max: 8, confianza: "media" },
  punto_hidraulico: { key: "punto_hidraulico", label: "Punto hidráulico", unidad: "unidad", porDia: 6, min: 4, max: 8, confianza: "media-baja" },
  punto_sanitario: { key: "punto_sanitario", label: "Punto sanitario / desagüe", unidad: "unidad", porDia: 4, min: 3, max: 6, confianza: "media-baja" },
  aparato_sanitario: { key: "aparato_sanitario", label: "Instalación aparato sanitario", unidad: "unidad", porDia: 5, min: 4, max: 6, confianza: "media" },

  // ── Madera / carpintería ──────────────────────────────────────────────────
  puerta_instalacion: { key: "puerta_instalacion", label: "Instalación puerta de paso", unidad: "unidad", porDia: 4, min: 3, max: 5, confianza: "media-baja" },
  closet: { key: "closet", label: "Closet a medida (instalación)", unidad: "ml", porDia: 2.5, min: 2, max: 4, confianza: "baja" },
  mueble_bajo_cocina: { key: "mueble_bajo_cocina", label: "Mueble bajo de cocina", unidad: "ml", porDia: 3, min: 2.5, max: 4, confianza: "baja" },
  mueble_alto_cocina: { key: "mueble_alto_cocina", label: "Mueble alto de cocina", unidad: "ml", porDia: 3.5, min: 3, max: 5, confianza: "baja" },
  mueble_bano: { key: "mueble_bano", label: "Mueble de baño", unidad: "unidad", porDia: 3, min: 2, max: 4, confianza: "baja" },
  lustro: { key: "lustro", label: "Lustro / barnizado de madera", unidad: "m2", porDia: 80, min: 60, max: 100, confianza: "baja" },

  // ── Sin clave en precios-semilla (matching propio) ────────────────────────
  demolicion: {
    key: "demolicion", label: "Demolición", unidad: "m2", porDia: 25, min: 15, max: 40, confianza: "media",
    match: ["demolicion", "demoler", "desmonte", "retiro de escombro", "picar"],
    nota: "Muy variable según material (mampostería vs. enchape).",
  },
  aseo: {
    key: "aseo", label: "Aseo / limpieza de obra", unidad: "m2", porDia: 60, min: 40, max: 80, confianza: "baja",
    match: ["aseo", "limpieza"],
  },
};

// ── Factores del motor (documentados; el motor los aplica) ──────────────────

/**
 * Factor de CUADRILLA ÚNICA: cuando toda la obra la ejecuta una sola cuadrilla
 * (cuadrillas = 1, el default B2C), la duración real es mayor que la suma
 * ideal de los rendimientos (una misma cuadrilla no es especialista en todos
 * los oficios, hay alistamientos y huecos entre fases). Rango investigado
 * 1.3–1.5; probable 1.4.
 */
export const FACTOR_CUADRILLA_UNICA = { min: 1.3, probable: 1.4, max: 1.5 };

/** Imprevistos por defecto (+20%); parámetro del motor. */
export const IMPREVISTOS_PCT_DEFAULT = 0.2;

// ── Buffers de SECADO/FRAGÜE: esperas entre fases (días CALENDARIO de espera,
// NO lentitud de la cuadrilla). El secado corre en paralelo en todos los
// espacios, por eso es UNA espera por transición y no escala con el área. ─────

/** Fragüe pañete → estuco (dentro de la fase Repello/Estuco). */
export const BUFFER_FRAGUE_PANETE = { min: 2, probable: 2.5, max: 3 };

/** Secado estuco → pintura y entre manos de pintura: ~1 día POR MANO. */
export const BUFFER_SECADO_POR_MANO = { min: 0.5, probable: 1, max: 1.5 };

/** Fragüe de placa antes de cargarla (placa → siguiente fase). */
export const BUFFER_FRAGUE_PLACA = { min: 7, probable: 10, max: 14 };

// ── Matching tarea → rendimiento ─────────────────────────────────────────────

import { buscarPrecioSemilla } from "./precios-semilla";

/** Normaliza para matching (mismo criterio que buscarPrecioSemilla). */
function limpiar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Busca el rendimiento que corresponde al nombre de una tarea.
 * 1) Reusa el matcher de la base semilla de precios (misma clave).
 * 2) Para claves sin precio semilla (demolición, aseo) usa sus `match`.
 * Devuelve `null` si no hay dato (el motor cae a los días acordados).
 */
export function buscarRendimiento(nombreTarea: string): Rendimiento | null {
  const p = buscarPrecioSemilla(nombreTarea);
  if (p && RENDIMIENTOS[p.key]) return RENDIMIENTOS[p.key];

  const n = limpiar(nombreTarea);
  let mejor: Rendimiento | null = null;
  let mejorLargo = 0;
  for (const r of Object.values(RENDIMIENTOS)) {
    for (const m of r.match ?? []) {
      const mm = limpiar(m);
      if (n.includes(mm) && mm.length > mejorLargo) {
        mejor = r;
        mejorLargo = mm.length;
      }
    }
  }
  return mejor;
}
