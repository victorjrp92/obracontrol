// ─────────────────────────────────────────────────────────────────────────
// Base de datos SEMILLA de precios de construcción Colombia (2025–2026).
// Fuente: investigación con triangulación de fuentes (Construdata/Presucosto,
// CYPE Generador de Precios, ICCU 2025 gov.co, Comfort Design, Incormaderas,
// MAE Ingeniería). Ver docs/ventas/.. o el commit de investigación.
//
// USO: semilla para el estimador "Sugerir presupuesto" (B2C: propietario y
// contratista). Cada obra que pasa por la app corrige/afina estos números
// (ver RegistroPrecio — capa de "precio justo"). Esto es el punto de partida,
// NO la verdad absoluta: cada precio trae su nivel de confianza.
//
// Precios en COP. Salvo donde se indique, son MANO DE OBRA del precio
// instalado (no incluyen material), porque la app estima sobre todo la M.O.
// La carpintería (closets, cocinas) suele cotizarse "a todo costo" → marcado.
// ─────────────────────────────────────────────────────────────────────────

import { normalizarParaMatch } from "./normalizar-tarea";

export type UnidadPrecio = "m2" | "ml" | "unidad" | "global";
export type Confianza = "alta" | "media" | "baja";
export type IncluyeMaterial = "no" | "si" | "parcial";

export interface PrecioSemilla {
  /** clave normalizada para matching */
  key: string;
  /**
   * Términos que, si aparecen en el nombre de la tarea, mapean a este precio.
   * Se comparan NORMALIZADOS (`normalizarParaMatch`): NO hace falta listar la
   * variante con conector ("estuco de pared" ≡ "estuco pared") ni con tilde.
   */
  match: string[];
  label: string;
  unidad: UnidadPrecio;
  medianoCOP: number;
  minCOP: number;
  maxCOP: number;
  incluyeMaterial: IncluyeMaterial;
  confianza: Confianza;
  /**
   * Fracción 0–1 del COSTO TOTAL de la tarea (mano de obra + materiales) que es
   * MANO DE OBRA; el resto (1 − pctManoObra) son materiales. Verificado contra
   * investigación 2026 (DANE/Camacol/Construdata). Para las categorías de
   * material muy variable (closet, cocinas, mueble de baño, aparato sanitario)
   * el usuario podrá ajustarlo; aquí queda el valor central como default.
   */
  pctManoObra: number;
  nota?: string;
}

/** Default de % mano de obra para tareas sin clave/coincidencia en la semilla. */
export const PCT_MANO_OBRA_DEFAULT = 0.45;

export const PRECIOS_SEMILLA: PrecioSemilla[] = [
  // ── Obra blanca / acabados ──────────────────────────────────────────────
  { key: "estuco_pared", match: ["estuco", "estuco pared", "estuco paredes"], label: "Estuco de paredes", unidad: "m2", medianoCOP: 9000, minCOP: 8000, maxCOP: 12000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.55 },
  { key: "estuco_techo", match: ["estuco techo", "estuco cielo"], label: "Estuco de techo", unidad: "m2", medianoCOP: 11000, minCOP: 9000, maxCOP: 14000, incluyeMaterial: "no", confianza: "baja", pctManoObra: 0.55, nota: "Estimado +15-25% sobre estuco de pared; poca data específica." },
  { key: "sellador", match: ["sellador"], label: "Sellador", unidad: "m2", medianoCOP: 4000, minCOP: 3000, maxCOP: 6000, incluyeMaterial: "no", confianza: "baja", pctManoObra: 0.55, nota: "Suele ir embebido en la 1ª mano de pintura." },
  { key: "pintura_base", match: ["pintura base", "primera mano"], label: "Pintura base", unidad: "m2", medianoCOP: 7000, minCOP: 6000, maxCOP: 9000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.55 },
  { key: "pintura_final", match: ["pintura final", "pintura", "vinilo"], label: "Pintura final / vinilo", unidad: "m2", medianoCOP: 11000, minCOP: 9000, maxCOP: 13000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.55 },
  { key: "enchape_piso", match: ["enchape piso", "ceramica piso", "piso ceramica", "baldosa piso", "baldoseria", "baldoseria piso", "acabado piso"], label: "Enchape / cerámica de piso", unidad: "m2", medianoCOP: 20000, minCOP: 15000, maxCOP: 25000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.42 },
  { key: "enchape_pared", match: ["enchape pared", "ceramica pared", "enchape baño", "enchape cocina", "baldoseria pared"], label: "Enchape de pared", unidad: "m2", medianoCOP: 26000, minCOP: 18000, maxCOP: 35000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.45 },
  { key: "porcelanato", match: ["porcelanato"], label: "Porcelanato", unidad: "m2", medianoCOP: 28000, minCOP: 22000, maxCOP: 50000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.25, nota: "Rango amplio según formato." },
  { key: "resane", match: ["resane", "resanar", "masilla", "dilatacion"], label: "Resane", unidad: "m2", medianoCOP: 8000, minCOP: 6000, maxCOP: 12000, incluyeMaterial: "no", confianza: "baja", pctManoObra: 0.65 },

  // ── Madera / carpintería ────────────────────────────────────────────────
  { key: "puerta_instalacion", match: ["puerta", "instalar puerta", "puerta de paso"], label: "Instalación puerta de paso (M.O.)", unidad: "unidad", medianoCOP: 90000, minCOP: 60000, maxCOP: 150000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.40, nota: "Solo instalación; el producto va aparte (350k-800k)." },
  { key: "closet", match: ["closet", "armario", "vestier"], label: "Closet a medida (fab.+inst.)", unidad: "ml", medianoCOP: 1800000, minCOP: 1500000, maxCOP: 2200000, incluyeMaterial: "si", confianza: "alta", pctManoObra: 0.30, nota: "A todo costo, por metro lineal. MDF +15-50%. Data de Medellín. Material variable: el usuario puede ajustar el % de M.O." },
  { key: "mueble_bajo_cocina", match: ["mueble bajo cocina", "cocina bajo"], label: "Mueble bajo de cocina (fab.+inst.)", unidad: "ml", medianoCOP: 400000, minCOP: 250000, maxCOP: 700000, incluyeMaterial: "parcial", confianza: "media", pctManoObra: 0.28, nota: "No incluye mesón ni electrodomésticos. Material variable: el usuario puede ajustar el % de M.O." },
  { key: "mueble_alto_cocina", match: ["mueble alto cocina", "cocina alto"], label: "Mueble alto de cocina (fab.+inst.)", unidad: "ml", medianoCOP: 400000, minCOP: 250000, maxCOP: 600000, incluyeMaterial: "parcial", confianza: "media", pctManoObra: 0.28, nota: "Material variable: el usuario puede ajustar el % de M.O." },
  { key: "mueble_bano", match: ["mueble baño", "lavamanos mueble", "vanity"], label: "Mueble de baño / lavamanos (fab.+inst.)", unidad: "unidad", medianoCOP: 800000, minCOP: 350000, maxCOP: 2000000, incluyeMaterial: "si", confianza: "media", pctManoObra: 0.28, nota: "Alta dispersión. Material variable: el usuario puede ajustar el % de M.O." },
  { key: "lustro", match: ["lustro", "barniz", "barnizado", "detallado", "lijado"], label: "Lustro / barnizado de madera (M.O.)", unidad: "m2", medianoCOP: 17000, minCOP: 14000, maxCOP: 22000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.55, nota: "Fuente única (CYPE), pero APU detallado." },

  // ── Instalaciones ─────────────────────────────────────────────────────────
  { key: "punto_electrico", match: ["punto electrico", "toma", "interruptor", "salida electrica"], label: "Punto eléctrico (M.O.)", unidad: "unidad", medianoCOP: 40000, minCOP: 25000, maxCOP: 65000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.45 },
  { key: "punto_hidraulico", match: ["punto hidraulico", "punto agua", "suministro agua"], label: "Punto hidráulico (M.O.)", unidad: "unidad", medianoCOP: 80000, minCOP: 65000, maxCOP: 138000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.45 },
  { key: "punto_sanitario", match: ["punto sanitario", "desague"], label: "Punto sanitario / desagüe (M.O.)", unidad: "unidad", medianoCOP: 100000, minCOP: 75000, maxCOP: 131000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.45 },
  { key: "aparato_sanitario", match: ["sanitario", "lavamanos", "ducha", "instalar aparato", "griferia"], label: "Instalación aparato sanitario (M.O.)", unidad: "unidad", medianoCOP: 60000, minCOP: 50000, maxCOP: 110000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.25, nota: "Material variable (el aparato): el usuario puede ajustar el % de M.O." },

  // ── Obra gris ─────────────────────────────────────────────────────────────
  { key: "mamposteria", match: ["mamposteria", "muro", "ladrillo", "bloque", "pared ladrillo"], label: "Mampostería / muro (M.O.)", unidad: "m2", medianoCOP: 24000, minCOP: 18000, maxCOP: 40000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.40 },
  { key: "panete", match: ["panete", "revoque", "repello"], label: "Pañete / revoque (M.O.)", unidad: "m2", medianoCOP: 15000, minCOP: 10000, maxCOP: 22000, incluyeMaterial: "no", confianza: "alta", pctManoObra: 0.40 },
  { key: "placa", match: ["placa", "estructura", "concreto armado", "losa"], label: "Placa / estructura (M.O.)", unidad: "m2", medianoCOP: 45000, minCOP: 35000, maxCOP: 55000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.28 },
  { key: "pulida_piso", match: ["pulida", "alisado", "piso concreto", "afinado"], label: "Pulida / alisado de piso (M.O.)", unidad: "m2", medianoCOP: 25000, minCOP: 20000, maxCOP: 35000, incluyeMaterial: "no", confianza: "media", pctManoObra: 0.65 },
];

// ── Factor regional (multiplicador de precios por ciudad) ──────────────────
// Investigación 2026 ya está incorporada en los precios base, que son la
// referencia de BOGOTÁ. El factor regional ajusta esa base a otras ciudades,
// con Bogotá = 1.00 como referencia (NO una base "neutra" aparte).
//   Bogotá 1.00 · Medellín 0.96 · Cali 0.92 · resto del país 0.85.
// Antes existían dos bases distintas (MULTIPLICADOR_CIUDAD con ~1.12 Bogotá y
// otra implícita); se UNIFICARON a esta única función `factorRegional`.
export const FACTOR_REGIONAL: Record<string, number> = {
  bogota: 1.0,
  medellin: 0.96,
  cali: 0.92,
  default: 0.85, // resto del país
};

/**
 * Busca el precio semilla que mejor coincide con el nombre de una tarea.
 *
 * Ambos lados se pasan por `normalizarParaMatch` (minúsculas, sin tildes, sin
 * puntuación y SIN palabras vacías), así que «Enchape de pared» encuentra el
 * término "enchape pared": el conector intermedio ya no rompe el `includes`.
 * Gana el término más largo (el más específico).
 */
export function buscarPrecioSemilla(nombreTarea: string): PrecioSemilla | null {
  return buscarPrecioSemillaConLargo(nombreTarea)?.precio ?? null;
}

/**
 * Igual que `buscarPrecioSemilla` pero devuelve también el LARGO del término
 * que ganó. Lo necesita `buscarRendimiento` (rendimientos.ts) para poder
 * comparar en igualdad de condiciones contra las claves que solo viven en la
 * tabla de rendimientos: sin el largo, un "muro" de 4 letras le ganaba a una
 * "demolicion" de 10 y una demolición se estimaba como si fuera levantar el
 * muro.
 */
export function buscarPrecioSemillaConLargo(
  nombreTarea: string,
): { precio: PrecioSemilla; largo: number } | null {
  const n = normalizarParaMatch(nombreTarea);
  if (!n) return null;
  let mejor: PrecioSemilla | null = null;
  let mejorLargo = 0;
  for (const p of PRECIOS_SEMILLA) {
    for (const m of p.match) {
      const mm = normalizarParaMatch(m);
      if (mm && n.includes(mm) && mm.length > mejorLargo) {
        mejor = p;
        mejorLargo = mm.length;
      }
    }
  }
  return mejor ? { precio: mejor, largo: mejorLargo } : null;
}

/**
 * Factor regional ÚNICO (multiplicador) sobre los precios base (referencia
 * Bogotá = 1.00). Bogotá 1.00 · Medellín 0.96 · Cali 0.92 · resto 0.85.
 * Reemplaza a `multiplicadorCiudad` (que partía de otra base ~1.12 Bogotá).
 */
export function factorRegional(ciudad?: string | null): number {
  if (!ciudad) return FACTOR_REGIONAL.bogota; // sin ciudad → referencia Bogotá
  const c = ciudad.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  for (const [k, v] of Object.entries(FACTOR_REGIONAL)) {
    if (k !== "default" && c.includes(k)) return v;
  }
  return FACTOR_REGIONAL.default;
}

/**
 * % de mano de obra (fracción 0–1) para el nombre de una tarea, según la base
 * semilla. Si la tarea no coincide con ninguna clave, usa PCT_MANO_OBRA_DEFAULT.
 */
export function pctManoObraDeTarea(nombreTarea: string): number {
  const p = buscarPrecioSemilla(nombreTarea);
  return p ? p.pctManoObra : PCT_MANO_OBRA_DEFAULT;
}
