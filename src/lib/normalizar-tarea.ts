// Normalización canónica del nombre de una tarea, para indexar precios.
// Misma transformación que usa `buscarPrecioSemilla` en precios-semilla.ts:
// minúsculas + sin tildes (NFD + quita marcas diacríticas) + colapsa espacios.
// Mantener UNA sola definición para que la captura (RegistroPrecio) y la lectura
// (getPrecioMercado) compartan exactamente la misma clave.
export function normalizarTarea(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────
// Normalización para MATCHING (no para indexar).
//
// `normalizarTarea` es la CLAVE que viaja a la base (RegistroPrecio,
// RegistroDuracion): no se puede tocar sin migrar datos. Esta segunda función
// es solo para comparar textos entre sí, así que puede ser más agresiva.
//
// El problema que resuelve: los matchers usaban `includes` literal sobre el
// texto normalizado, así que un conector intermedio rompía el match —
// "Enchape de pared" no contiene "enchape pared". Quitando las palabras vacías
// (de, del, la, el, en, y, con…) toda la familia «X de Y» matchea de una vez,
// sin tener que enumerar alias uno por uno.
// ─────────────────────────────────────────────────────────────────────────

/** Conectores que no aportan significado al nombre de una tarea. */
const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "un", "una", "en", "y", "con", "para", "al", "a",
]);

/**
 * Normaliza un texto para COMPARARLO con otro (nunca para guardarlo):
 * `normalizarTarea` + puntuación a espacio + fuera las palabras vacías.
 *
 *   "Enchape de pared"   → "enchape pared"
 *   "Cielo raso en drywall" → "cielo raso drywall"
 *   "Sala-comedor"       → "sala comedor"
 *
 * Se aplica a AMBOS lados de la comparación (texto del usuario y término de la
 * semilla), por eso no rompe ningún match que ya funcionaba.
 */
export function normalizarParaMatch(texto: string): string {
  return normalizarTarea(texto)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !PALABRAS_VACIAS.has(w))
    .join(" ");
}
