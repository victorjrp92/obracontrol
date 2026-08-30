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
// (buscarPrecioSemilla). Las claves SIN precio semilla (`demolicion`, `aseo`,
// `drywall`, `impermeabilizacion`, `meson`, `ventana`, `mueble_generico`)
// traen sus propios términos de matching (`match`) y su fase se resuelve por
// KEYWORDS_FASE en fases-obra.ts.
//
// El matching de ambos lados pasa por `normalizarParaMatch`, que quita las
// palabras vacías: no hay que listar la variante con conector — "cielo raso en
// drywall" encuentra "cielo raso" sola.
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
  /**
   * Términos de matching propios de la tabla de RENDIMIENTOS. Los usan las
   * claves sin entrada en precios-semilla (demolición, aseo, drywall…) y las
   * que necesitan reconocer un nombre para la duración sin arrastrar el
   * precio de esa clave.
   */
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
  mueble_bano: {
    key: "mueble_bano", label: "Mueble de baño", unidad: "unidad", porDia: 3, min: 2, max: 4, confianza: "baja",
    // Solo para DURACIÓN: un gabinete de espejo se instala como un mueble de
    // baño, pero no cuesta como uno (la semilla de precios no lo mapea).
    match: ["gabinete"],
  },
  lustro: { key: "lustro", label: "Lustro / barnizado de madera", unidad: "m2", porDia: 80, min: 60, max: 100, confianza: "baja" },

  // ── Sin clave en precios-semilla (matching propio) ────────────────────────
  demolicion: {
    key: "demolicion", label: "Demolición", unidad: "m2", porDia: 25, min: 15, max: 40, confianza: "media",
    match: ["demolicion", "demoler", "desmonte", "retiro", "picar", "desmantelamiento"],
    nota: "Muy variable según material (mampostería vs. enchape).",
  },
  aseo: {
    key: "aseo", label: "Aseo / limpieza de obra", unidad: "m2", porDia: 60, min: 40, max: 80, confianza: "baja",
    match: ["aseo", "limpieza"],
  },
  drywall: {
    key: "drywall", label: "Cielo raso / muro en drywall", unidad: "m2", porDia: 12, min: 9, max: 16, confianza: "baja",
    match: ["drywall", "cielo raso", "superboard", "panel yeso"],
    nota: "Incluye estructura + panel; el acabado (masilla/pintura) va aparte.",
  },
  impermeabilizacion: {
    key: "impermeabilizacion", label: "Impermeabilización", unidad: "m2", porDia: 25, min: 18, max: 35, confianza: "baja",
    match: ["impermeabiliz", "manto asfaltico"],
    nota: "Terrazas y cubiertas. Sin el tiempo de curado (eso es espera, no trabajo).",
  },
  meson: {
    key: "meson", label: "Mesón (instalación)", unidad: "ml", porDia: 2.5, min: 2, max: 3.5, confianza: "baja",
    match: ["meson", "barra cocina"],
  },
  ventana: {
    key: "ventana", label: "Ventana (instalación)", unidad: "unidad", porDia: 3, min: 2, max: 4, confianza: "baja",
    match: ["ventana", "ventaneria"],
  },
  mueble_generico: {
    key: "mueble_generico", label: "Mueble a medida (instalación)", unidad: "ml", porDia: 3, min: 2.5, max: 4, confianza: "baja",
    match: ["mueble"],
    nota: "Último recurso: solo entra si ninguna clave específica de mueble matchea.",
  },
};

// ── Factores del motor (documentados; el motor los aplica) ──────────────────
//
// Ecuación de cierre del motor (docs/specs/algoritmo-duracion.md §5, con las
// esperas fuera de `f` — el porqué está en el paso 6 de estimar-duracion.ts):
//
//     D_obra = f · ( O_0 + D_trabajo ) + Λ_ef
//
// Λ_ef son los lags de secado que sobreviven a la absorción por trabajo
// paralelo, ya convertidos de días calendario a días hábiles con ρ (leaf-3.3).
//
// UN solo factor multiplicativo `f` y UN overhead fijo `O_0`. Antes había dos
// factores que se multiplicaban a ciegas (×1.4 «cuadrilla única» × ×1.2
// «imprevistos» = ×1.68 constante) y ningún overhead. Un factor puramente
// multiplicativo no puede ajustar los tres casos de cordura a la vez: el
// factor que reconcilia con la realidad DECRECE con el tamaño (×1.61 en un
// baño, ×1.30 en un apto, ×1.19 en una casa). Eso es la firma de un costo que
// no escala con la obra — o sea, un sumando, no un factor.

/**
 * FACTOR DE PRODUCTIVIDAD REAL `f`. Único factor multiplicativo del motor.
 *
 * Qué absorbe (lo que antes estaba repartido en dos constantes):
 *  - una cuadrilla no es especialista en todos los oficios;
 *  - alistamientos, huecos entre tareas y retrabajo;
 *  - imprevistos ordinarios de obra (material que llega tarde, día de lluvia).
 *
 * NO desaparece cuando hay más de una cuadrilla. Ese era el defecto §4.3:
 * con `cuadrillas = 2` el motor quitaba el ×1.4 Y además dividía por 2, y la
 * obra se aceleraba 2.7× con el doble de recursos. Dos cuadrillas no son
 * sobrehumanas; son dos cuadrillas. El efecto del número de cuadrillas vive en
 * `EXPONENTE_CUADRILLAS`, no aquí.
 *
 * CALIBRACIÓN — barrido (O_0, f) rehecho sobre el motor de HOY, no heredado:
 * lo corre `scripts/verificar-duracion-calibracion.ts` (§8) en cada ejecución.
 * 37 de 273 combinaciones meten los tres casos patrón en banda (17 también la
 * cocina); (O_0 = 1.6, f = 1.78) es la que maximiza el margen mínimo a los
 * bordes de los CUATRO casos de cordura a la vez (0.40 de media banda, contra
 * 0.00 del argmax de tres casos) y la que aguanta el mayor desplazamiento sin
 * salirse (±0.06 en `f`, ±1.2 en `O_0`) → baño 9 d · cocina 18 d · apto 62 d ·
 * casa 116 d.
 *
 * ⚠️ SUBE respecto al 1.65 de leaf-3.2, y la causa es medible: leaf-3.3 dejó de
 * cobrar las esperas de secado como sumandos de la ruta crítica. En una obra
 * con varios espacios el secado se absorbe con el trabajo de los otros
 * (Λ_ef = 0), así que el apto perdía 4 días y se caía a 59 (banda 60–70). Lo
 * que antes aportaba una espera mal contada tiene que aportarlo ahora el factor
 * de productividad, que es donde de verdad vive: la obra no va lenta porque el
 * mortero fragüe, va lenta porque la cuadrilla rinde menos de lo que dice el APU.
 *
 * ⚠️ CONTRADICE al documento, que propone f = 1.40 con O_0 = 2. Ese barrido se
 * hizo ANTES de arreglar el matcher, cuando el 30–41% del trabajo caía en
 * «Otros» y se estimaba con los días que ponía el usuario (2 d por tarea, muy
 * lentos). Al reconocer esas tareas, el makespan crudo BAJÓ y el factor que lo
 * reconcilia con la realidad tuvo que subir en la misma proporción. Hoy
 * (2, 1.40) deja el apto y la casa FUERA de banda por debajo.
 *
 * Banda min/max: borde optimista / pesimista de la MISMA obra. Se reescala con
 * el centro conservando las proporciones del motor viejo (min/probable = 0.788,
 * max/probable = 1.091), así que el ANCHO RELATIVO del intervalo que ve el
 * usuario no se ha tocado nunca: lo único que se mueve es el centro. El sesgo a
 * la derecha es el de la duración de obra: se llega tarde más a menudo de lo
 * que se llega temprano.
 */
export const FACTOR_PRODUCTIVIDAD_REAL = { min: 1.4, probable: 1.78, max: 1.94 };

/**
 * OVERHEAD FIJO `O_0` de la obra, en DÍAS DE CUADRILLA (no en días calendario:
 * entra a la ecuación antes de `f`).
 *
 * Qué es: movilización y montaje del sitio, compra y acarreo de materiales,
 * replanteo, y la entrega con sus remates. Se paga una vez y **no escala con
 * el tamaño de la obra**: comprar la grifería de un baño cuesta los mismos dos
 * viajes que la de tres baños. Es lo que hace que un baño de 5 m² no pueda
 * durar 3 días por mucho que el trabajo puro sume 2.5.
 *
 * Tampoco escala con las cuadrillas: el replanteo y las compras no se hacen al
 * doble de rápido porque haya dos cuadrillas. Por eso el motor NO lo divide
 * por `c_eff`.
 *
 * Calibrado en el mismo barrido que `f`. Honestidad sobre lo que el barrido
 * NO prueba: con el matcher arreglado los factores de reconciliación quedaron
 * casi planos entre tamaños, así que también hay puntos con O_0 ≈ 0 que meten
 * los tres casos patrón en banda. O_0 se conserva porque (a) maximiza el
 * margen a los bordes y (b) es real: sin él, una obra descrita con cuatro
 * tareas dura lo que suman esas cuatro tareas, y nadie moviliza, compra,
 * replantea y entrega en cero días.
 *
 * BAJA de 2.5 a 1.6 en leaf-3.3 por el mismo barrido que subió `f`: al dejar de
 * cobrar el secado como ruta crítica, el término que hacía falta era el que
 * ESCALA con la obra (el apto perdía 4 días y el baño solo 0.4), no el que no
 * escala. Los dos parámetros se movieron en direcciones opuestas y el producto
 * f·O_0 apenas cambió (4.13 → 2.85 días de apertura y cierre).
 */
export const OVERHEAD_FIJO_CD = { min: 1.0, probable: 1.6, max: 2.6 };

/**
 * Exponente de rendimientos decrecientes por cuadrillas: `c_eff = c^0.85`.
 *
 * Continuo en c = 1 (vale exactamente 1: sin salto al pasar de 1 a 2, que era
 * el defecto de dividir por `cuadrillas` y quitar a la vez el factor) y
 * sub-lineal: duplicar cuadrillas acelera ×1.80, no ×2. Cada cuadrilla extra
 * añade coordinación, interferencia y espera de frente de trabajo.
 */
export const EXPONENTE_CUADRILLAS = 0.85;

// ── Tope de CONGESTIÓN FÍSICA: `a_min` ──────────────────────────────────────
// m² de espacio que necesita UNA cuadrilla del oficio para trabajar sin
// estorbar a la de al lado. El tope de cuadrillas útiles en un espacio es
// `área_del_espacio / a_min`: impide meter 4 cuadrillas en un baño de 5 m².
//
// ⚠️ ESTOS NÚMEROS SON JUICIO DE OFICIO, NO MEDICIÓN. No hay observación de
// campo detrás (docs/specs/algoritmo-duracion.md §10.7 los lista entre «lo que
// no se puede saber sin datos que no existen»). Son un tope de cordura, no una
// constante física: sirven para que el motor no prometa imposibles, y se
// reemplazan en cuanto haya obras medidas.

/** Oficios sin `a_min` propio (demolición, aseo, carpintería, muebles…). */
export const A_MIN_DEFAULT = 8;

export const A_MIN_M2: Record<string, number> = {
  // Oficios HÚMEDOS (baldes, mezcla, andamios en el piso): 6 m² por cuadrilla.
  estuco_pared: 6, estuco_techo: 6, panete: 6, resane: 6,
  enchape_piso: 6, enchape_pared: 6, porcelanato: 6,
  mamposteria: 6, placa: 6, pulida_piso: 6, impermeabilizacion: 6,
  // PINTURA: la que más frente de trabajo necesita (rodillo, brocha, andamio
  // móvil, y nadie más puede pisar lo recién pintado): 10 m².
  pintura_base: 10, pintura_final: 10, sellador: 10, lustro: 10,
  // INSTALACIONES: trabajo puntual, se estorban menos: 8 m².
  punto_electrico: 8, punto_hidraulico: 8, punto_sanitario: 8, aparato_sanitario: 8,
};

/** `a_min` del oficio de una clave de rendimiento (o el default si no la hay). */
export function aMinDe(key: string | null | undefined): number {
  return (key && A_MIN_M2[key]) || A_MIN_DEFAULT;
}

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

import { buscarPrecioSemillaConLargo } from "./precios-semilla";
import { normalizarParaMatch } from "./normalizar-tarea";

/**
 * Busca el rendimiento que corresponde al nombre de una tarea.
 *
 * Dos vocabularios compiten: los `match` de la base semilla de precios (misma
 * clave) y los `match` propios de las claves que no tienen precio (demolición,
 * aseo, drywall…). Gana el término MÁS LARGO de los dos, no el de precios por
 * ser de precios: «Demolición de muro» debe caer en `demolicion` (10 letras),
 * no en `mamposteria` porque contiene "muro" (4).
 *
 * Devuelve `null` si no hay dato (el motor cae a los días acordados).
 */
export function buscarRendimiento(nombreTarea: string): Rendimiento | null {
  const n = normalizarParaMatch(nombreTarea);
  if (!n) return null;

  const p = buscarPrecioSemillaConLargo(nombreTarea);
  const desdePrecio = p && RENDIMIENTOS[p.precio.key] ? RENDIMIENTOS[p.precio.key] : null;
  let mejor: Rendimiento | null = desdePrecio;
  let mejorLargo = desdePrecio && p ? p.largo : 0;

  for (const r of Object.values(RENDIMIENTOS)) {
    for (const m of r.match ?? []) {
      const mm = normalizarParaMatch(m);
      if (mm && n.includes(mm) && mm.length > mejorLargo) {
        mejor = r;
        mejorLargo = mm.length;
      }
    }
  }
  return mejor;
}
