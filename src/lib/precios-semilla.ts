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

export type UnidadPrecio = "m2" | "ml" | "unidad" | "global";
export type Confianza = "alta" | "media" | "baja";
export type IncluyeMaterial = "no" | "si" | "parcial";

export interface PrecioSemilla {
  /** clave normalizada para matching */
  key: string;
  /** términos que, si aparecen en el nombre de la tarea, mapean a este precio */
  match: string[];
  label: string;
  unidad: UnidadPrecio;
  medianoCOP: number;
  minCOP: number;
  maxCOP: number;
  incluyeMaterial: IncluyeMaterial;
  confianza: Confianza;
  nota?: string;
}

export const PRECIOS_SEMILLA: PrecioSemilla[] = [
  // ── Obra blanca / acabados ──────────────────────────────────────────────
  { key: "estuco_pared", match: ["estuco pared", "estuco de pared", "estuco paredes"], label: "Estuco de paredes", unidad: "m2", medianoCOP: 9000, minCOP: 8000, maxCOP: 12000, incluyeMaterial: "no", confianza: "media" },
  { key: "estuco_techo", match: ["estuco techo", "estuco de techo", "estuco cielo"], label: "Estuco de techo", unidad: "m2", medianoCOP: 11000, minCOP: 9000, maxCOP: 14000, incluyeMaterial: "no", confianza: "baja", nota: "Estimado +15-25% sobre estuco de pared; poca data específica." },
  { key: "sellador", match: ["sellador"], label: "Sellador", unidad: "m2", medianoCOP: 4000, minCOP: 3000, maxCOP: 6000, incluyeMaterial: "no", confianza: "baja", nota: "Suele ir embebido en la 1ª mano de pintura." },
  { key: "pintura_base", match: ["pintura base", "primera mano"], label: "Pintura base", unidad: "m2", medianoCOP: 7000, minCOP: 6000, maxCOP: 9000, incluyeMaterial: "no", confianza: "alta" },
  { key: "pintura_final", match: ["pintura final", "pintura", "vinilo"], label: "Pintura final / vinilo", unidad: "m2", medianoCOP: 11000, minCOP: 9000, maxCOP: 13000, incluyeMaterial: "no", confianza: "alta" },
  { key: "enchape_piso", match: ["enchape piso", "ceramica piso", "cerámica de piso", "piso ceramica", "baldosa piso"], label: "Enchape / cerámica de piso", unidad: "m2", medianoCOP: 20000, minCOP: 15000, maxCOP: 25000, incluyeMaterial: "no", confianza: "alta" },
  { key: "enchape_pared", match: ["enchape pared", "ceramica pared", "cerámica de pared", "enchape baño", "enchape cocina"], label: "Enchape de pared", unidad: "m2", medianoCOP: 26000, minCOP: 18000, maxCOP: 35000, incluyeMaterial: "no", confianza: "alta" },
  { key: "porcelanato", match: ["porcelanato"], label: "Porcelanato", unidad: "m2", medianoCOP: 28000, minCOP: 22000, maxCOP: 50000, incluyeMaterial: "no", confianza: "media", nota: "Rango amplio según formato." },
  { key: "resane", match: ["resane", "masilla", "dilatacion"], label: "Resane", unidad: "m2", medianoCOP: 8000, minCOP: 6000, maxCOP: 12000, incluyeMaterial: "no", confianza: "baja" },

  // ── Madera / carpintería ────────────────────────────────────────────────
  { key: "puerta_instalacion", match: ["puerta", "instalar puerta", "puerta de paso"], label: "Instalación puerta de paso (M.O.)", unidad: "unidad", medianoCOP: 90000, minCOP: 60000, maxCOP: 150000, incluyeMaterial: "no", confianza: "media", nota: "Solo instalación; el producto va aparte (350k-800k)." },
  { key: "closet", match: ["closet", "clóset", "armario"], label: "Closet a medida (fab.+inst.)", unidad: "ml", medianoCOP: 1800000, minCOP: 1500000, maxCOP: 2200000, incluyeMaterial: "si", confianza: "alta", nota: "A todo costo, por metro lineal. MDF +15-50%. Data de Medellín." },
  { key: "mueble_bajo_cocina", match: ["mueble bajo cocina", "mueble bajo de cocina", "cocina bajo"], label: "Mueble bajo de cocina (fab.+inst.)", unidad: "ml", medianoCOP: 400000, minCOP: 250000, maxCOP: 700000, incluyeMaterial: "parcial", confianza: "media", nota: "No incluye mesón ni electrodomésticos." },
  { key: "mueble_alto_cocina", match: ["mueble alto cocina", "mueble alto de cocina", "cocina alto"], label: "Mueble alto de cocina (fab.+inst.)", unidad: "ml", medianoCOP: 400000, minCOP: 250000, maxCOP: 600000, incluyeMaterial: "parcial", confianza: "media" },
  { key: "mueble_bano", match: ["mueble baño", "mueble de baño", "lavamanos mueble", "vanity"], label: "Mueble de baño / lavamanos (fab.+inst.)", unidad: "unidad", medianoCOP: 800000, minCOP: 350000, maxCOP: 2000000, incluyeMaterial: "si", confianza: "media", nota: "Alta dispersión." },
  { key: "lustro", match: ["lustro", "barniz", "barnizado", "detallado", "lijado"], label: "Lustro / barnizado de madera (M.O.)", unidad: "m2", medianoCOP: 17000, minCOP: 14000, maxCOP: 22000, incluyeMaterial: "no", confianza: "media", nota: "Fuente única (CYPE), pero APU detallado." },

  // ── Instalaciones ─────────────────────────────────────────────────────────
  { key: "punto_electrico", match: ["punto electrico", "punto eléctrico", "toma", "interruptor", "salida electrica"], label: "Punto eléctrico (M.O.)", unidad: "unidad", medianoCOP: 40000, minCOP: 25000, maxCOP: 65000, incluyeMaterial: "no", confianza: "alta" },
  { key: "punto_hidraulico", match: ["punto hidraulico", "punto hidráulico", "punto agua", "suministro agua"], label: "Punto hidráulico (M.O.)", unidad: "unidad", medianoCOP: 80000, minCOP: 65000, maxCOP: 138000, incluyeMaterial: "no", confianza: "alta" },
  { key: "punto_sanitario", match: ["punto sanitario", "desague", "desagüe"], label: "Punto sanitario / desagüe (M.O.)", unidad: "unidad", medianoCOP: 100000, minCOP: 75000, maxCOP: 131000, incluyeMaterial: "no", confianza: "alta" },
  { key: "aparato_sanitario", match: ["sanitario", "lavamanos", "ducha", "instalar aparato", "grifería", "griferia"], label: "Instalación aparato sanitario (M.O.)", unidad: "unidad", medianoCOP: 60000, minCOP: 50000, maxCOP: 110000, incluyeMaterial: "no", confianza: "alta" },

  // ── Obra gris ─────────────────────────────────────────────────────────────
  { key: "mamposteria", match: ["mamposteria", "mampostería", "muro", "ladrillo", "bloque", "pared ladrillo"], label: "Mampostería / muro (M.O.)", unidad: "m2", medianoCOP: 24000, minCOP: 18000, maxCOP: 40000, incluyeMaterial: "no", confianza: "alta" },
  { key: "panete", match: ["pañete", "panete", "revoque", "repello"], label: "Pañete / revoque (M.O.)", unidad: "m2", medianoCOP: 15000, minCOP: 10000, maxCOP: 22000, incluyeMaterial: "no", confianza: "alta" },
  { key: "placa", match: ["placa", "estructura", "concreto armado", "losa"], label: "Placa / estructura (M.O.)", unidad: "m2", medianoCOP: 45000, minCOP: 35000, maxCOP: 55000, incluyeMaterial: "no", confianza: "media" },
  { key: "pulida_piso", match: ["pulida", "alisado", "piso concreto", "afinado"], label: "Pulida / alisado de piso (M.O.)", unidad: "m2", medianoCOP: 25000, minCOP: 20000, maxCOP: 35000, incluyeMaterial: "no", confianza: "media" },
];

// Multiplicador por ciudad (Bogotá/Medellín ~+10-15% según fuentes).
export const MULTIPLICADOR_CIUDAD: Record<string, number> = {
  bogota: 1.12, "bogotá": 1.12, medellin: 1.10, "medellín": 1.10,
  cali: 1.0, barranquilla: 1.0, cartagena: 1.05, default: 1.0,
};

/** Busca el precio semilla que mejor coincide con el nombre de una tarea. */
export function buscarPrecioSemilla(nombreTarea: string): PrecioSemilla | null {
  const n = nombreTarea.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let mejor: PrecioSemilla | null = null;
  let mejorLargo = 0;
  for (const p of PRECIOS_SEMILLA) {
    for (const m of p.match) {
      const mm = m.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (n.includes(mm) && mm.length > mejorLargo) {
        mejor = p;
        mejorLargo = mm.length;
      }
    }
  }
  return mejor;
}

export function multiplicadorCiudad(ciudad?: string | null): number {
  if (!ciudad) return 1.0;
  const c = ciudad.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  for (const [k, v] of Object.entries(MULTIPLICADOR_CIUDAD)) {
    if (k !== "default" && c.includes(k)) return v;
  }
  return MULTIPLICADOR_CIUDAD.default;
}
