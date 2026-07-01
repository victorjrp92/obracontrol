// Configuración editable de la landing de beta.
// Aquí viven los dos valores que Victor puede querer ajustar sin tocar el markup.

// ─────────────────────────────────────────────────────────────────────────────
// TODO Victor: reemplaza esta URL con el link real de tu formulario Tally.
// Lo encuentras en Tally → tu formulario → "Share" → "Embed" (o la URL pública,
// del tipo https://tally.so/r/ABC123). Pega SOLO la URL; el iframe ya está listo.
// ─────────────────────────────────────────────────────────────────────────────
export const TALLY_EMBED_URL = "https://tally.so/r/XXXXXX";

// Cuando la URL siga en el placeholder mostramos el bloque de fallback en vez del
// iframe, para que nunca se vea un formulario roto en producción.
export const TALLY_PLACEHOLDER = "https://tally.so/r/XXXXXX";

// Escasez real (NO es un contador dinámico: es la oferta honesta del beta).
// 16 cupos totales = 8 propietarios + 8 contratistas.
export const CUPOS_TOTALES = 16;
export const CUPOS_POR_PERFIL = 8;

// ─────────────────────────────────────────────────────────────────────────────
// TODO Victor (OPCIONAL): urgencia honesta manual.
// Si en algún momento quieres mostrar cuántos cupos quedan de verdad, pon aquí el
// número real y añádelo al markup donde lo necesites (p. ej. en BetaOffer).
// Déjalo en null para NO mostrar nada: es preferible no inventar un contador.
// ─────────────────────────────────────────────────────────────────────────────
export const CUPOS_RESTANTES: number | null = null;
