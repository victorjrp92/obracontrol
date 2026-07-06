// ─────────────────────────────────────────────────────────────────────────
// FASES CURADAS de una obra B2C (spec Excel único + cronograma).
//
// La lista está en ORDEN CONSTRUCTIVO: es la secuencia que usa el motor de
// duración (estimar-duracion.ts) y el orden del dropdown de la plantilla
// Excel. La importación acepta variantes ("eléctricos", "obra gris", etc.)
// vía `normalizarFase`; lo que no se reconozca se devuelve al usuario para
// mapeo manual (y, en otra capa, a la IA — NUNCA aquí: este módulo es
// determinista y puro).
// ─────────────────────────────────────────────────────────────────────────

export const FASES_OBRA = [
  "Preliminares/Demolición",
  "Obra gris/Estructura",
  "Instalaciones eléctricas",
  "Instalaciones hidrosanitarias",
  "Repello/Estuco",
  "Pintura",
  "Pisos/Enchapes",
  "Carpintería/Madera",
  "Cocina/Closets",
  "Aparatos y grifería",
  "Detalles y aseo",
] as const;

export type FaseObra = (typeof FASES_OBRA)[number];

/** Orden constructivo de una fase (0..n). -1 si no es una fase curada. */
export function ordenFase(fase: string): number {
  return (FASES_OBRA as readonly string[]).indexOf(fase);
}

/** Normalización de texto para matching: minúsculas, sin tildes, sin espacios extra. */
function limpiar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Variantes aceptadas por fase (además del nombre curado). El matching es por
// INCLUSIÓN de keyword en el texto del usuario, con la keyword más larga
// ganando (mismo criterio que buscarPrecioSemilla). El orden dentro de cada
// lista no importa.
const VARIANTES_FASE: Record<FaseObra, string[]> = {
  "Preliminares/Demolición": ["preliminar", "demolicion", "demoler", "desmonte", "retiro", "desmantelamiento"],
  "Obra gris/Estructura": ["obra gris", "gris", "estructura", "mamposteria", "muros", "cimentacion", "placa", "losa", "concreto"],
  "Instalaciones eléctricas": ["electrica", "electrico", "electricidad", "cableado", "red electrica"],
  "Instalaciones hidrosanitarias": ["hidrosanitaria", "hidraulica", "hidraulico", "sanitaria", "plomeria", "fontaneria", "tuberia", "red hidraulica", "instalaciones hidro"],
  "Repello/Estuco": ["repello", "estuco", "panete", "pañete", "revoque", "resane", "friso"],
  "Pintura": ["pintura", "pintar", "vinilo", "acabados de pintura"],
  "Pisos/Enchapes": ["piso", "pisos", "enchape", "ceramica", "porcelanato", "baldosa", "acabados de piso", "recubrimiento"],
  "Carpintería/Madera": ["carpinteria", "madera", "puertas", "ebanisteria", "lustro", "barniz"],
  "Cocina/Closets": ["cocina", "closet", "closets", "muebles", "mobiliario", "vestier"],
  "Aparatos y grifería": ["aparato", "aparatos", "griferia", "sanitarios", "lavamanos", "ducha", "accesorios de baño"],
  "Detalles y aseo": ["detalle", "detalles", "aseo", "limpieza", "remates", "entrega"],
};

/**
 * Normaliza una fase escrita por el usuario a la lista curada.
 * Tolerante: acepta el nombre exacto, mayúsculas/tildes distintas y variantes
 * comunes ("plomería" → "Instalaciones hidrosanitarias"). Devuelve `null` si
 * no se reconoce (el front la ofrece para mapeo manual).
 */
export function normalizarFase(texto: string): FaseObra | null {
  const t = limpiar(texto);
  if (!t) return null;

  // 1) Match exacto contra el nombre curado (normalizado).
  for (const fase of FASES_OBRA) {
    if (limpiar(fase) === t) return fase;
  }

  // 2) Variantes por inclusión; gana la keyword más larga (más específica).
  let mejor: FaseObra | null = null;
  let mejorLargo = 0;
  for (const fase of FASES_OBRA) {
    for (const v of VARIANTES_FASE[fase]) {
      const vv = limpiar(v);
      if ((t.includes(vv) || vv.includes(t)) && vv.length > mejorLargo) {
        mejor = fase;
        mejorLargo = vv.length;
      }
    }
  }
  return mejor;
}

// ─────────────────────────────────────────────────────────────────────────
// Clasificación de TAREAS en fases (determinista).
// ─────────────────────────────────────────────────────────────────────────

import { buscarPrecioSemilla } from "./precios-semilla";

/**
 * Mapa clave de la base semilla (precios-semilla.ts) → fase curada.
 * Es la vía DETERMINISTA principal: si `buscarPrecioSemilla` reconoce la
 * tarea, su key define la fase sin ambigüedad.
 */
export const FASE_POR_KEY: Record<string, FaseObra> = {
  // Obra gris
  mamposteria: "Obra gris/Estructura",
  placa: "Obra gris/Estructura",
  pulida_piso: "Pisos/Enchapes",
  // Repello / estuco
  panete: "Repello/Estuco",
  estuco_pared: "Repello/Estuco",
  estuco_techo: "Repello/Estuco",
  resane: "Repello/Estuco",
  // Pintura
  sellador: "Pintura",
  pintura_base: "Pintura",
  pintura_final: "Pintura",
  // Pisos / enchapes
  enchape_piso: "Pisos/Enchapes",
  enchape_pared: "Pisos/Enchapes",
  porcelanato: "Pisos/Enchapes",
  // Instalaciones
  punto_electrico: "Instalaciones eléctricas",
  punto_hidraulico: "Instalaciones hidrosanitarias",
  punto_sanitario: "Instalaciones hidrosanitarias",
  aparato_sanitario: "Aparatos y grifería",
  // Carpintería / muebles
  puerta_instalacion: "Carpintería/Madera",
  lustro: "Carpintería/Madera",
  closet: "Cocina/Closets",
  mueble_bajo_cocina: "Cocina/Closets",
  mueble_alto_cocina: "Cocina/Closets",
  mueble_bano: "Cocina/Closets",
  // Sin clave semilla pero con rendimiento (rendimientos.ts)
  demolicion: "Preliminares/Demolición",
  aseo: "Detalles y aseo",
};

// Heurística por keywords para tareas SIN clave semilla. Se evalúa después de
// buscarPrecioSemilla; gana la keyword más larga.
const KEYWORDS_FASE: [string, FaseObra][] = [
  ["demolicion", "Preliminares/Demolición"],
  ["demoler", "Preliminares/Demolición"],
  ["desmonte", "Preliminares/Demolición"],
  ["retiro de escombro", "Preliminares/Demolición"],
  ["cielo raso", "Obra gris/Estructura"],
  ["drywall", "Obra gris/Estructura"],
  ["superboard", "Obra gris/Estructura"],
  ["impermeabiliza", "Obra gris/Estructura"],
  ["bombillo", "Instalaciones eléctricas"],
  ["lampara", "Instalaciones eléctricas"],
  ["breaker", "Instalaciones eléctricas"],
  ["tablero electrico", "Instalaciones eléctricas"],
  ["calentador", "Instalaciones hidrosanitarias"],
  ["tuberia", "Instalaciones hidrosanitarias"],
  ["laminado", "Pisos/Enchapes"],
  ["vinilico", "Pisos/Enchapes"],
  ["guardaescoba", "Pisos/Enchapes"],
  ["ventana", "Carpintería/Madera"],
  ["marco", "Carpintería/Madera"],
  ["meson", "Cocina/Closets"],
  ["estufa", "Cocina/Closets"],
  ["campana", "Cocina/Closets"],
  ["espejo", "Detalles y aseo"],
  ["aseo", "Detalles y aseo"],
  ["limpieza", "Detalles y aseo"],
];

/**
 * Fase curada de una tarea por su nombre. DETERMINISTA:
 *  1) `buscarPrecioSemilla(nombre)` → key → FASE_POR_KEY.
 *  2) Heurística por keywords (KEYWORDS_FASE).
 *  3) `null` si nada matchea (la clasificación por IA de tareas no
 *     reconocidas vive en otra capa, NUNCA aquí).
 */
export function faseDeTarea(nombre: string): FaseObra | null {
  const p = buscarPrecioSemilla(nombre);
  if (p && FASE_POR_KEY[p.key]) return FASE_POR_KEY[p.key];

  const n = limpiar(nombre);
  let mejor: FaseObra | null = null;
  let mejorLargo = 0;
  for (const [kw, fase] of KEYWORDS_FASE) {
    if (n.includes(kw) && kw.length > mejorLargo) {
      mejor = fase;
      mejorLargo = kw.length;
    }
  }
  return mejor;
}
