// Configuración editable de /repara (Seiricon Go — campaña de reparaciones
// post-sismo). Mismo patrón que src/components/beta/config.ts y
// src/components/alerta/config.ts: los valores que Karen puede ajustar sin
// tocar el markup viven aquí, y todo lo que aún no está confirmado queda como
// placeholder literal `TODO(confirmar-*)`.
//
// REGLA DURA de esta carpeta: mientras un valor siga siendo su placeholder, la
// UI NO renderiza el bloque que lo usa. Nunca se inventa una fecha, un número
// de cupos ni un teléfono en una campaña dirigida a damnificados de un sismo.

// ─────────────────────────────────────────────────────────────────────────
// TODO(confirmar-tally): URL real del formulario Tally de captación de cupos.
// Tally → tu formulario → "Share" → "Embed" (o la URL pública del tipo
// https://tally.so/r/ABC123). Pega SOLO la URL; el iframe ya está listo en
// ReparaForm.tsx. Mientras siga en el placeholder, ReparaForm muestra el
// fallback de contacto real (correo) — no un mensaje dirigido al desarrollador.
// ─────────────────────────────────────────────────────────────────────────
export const TALLY_REPARA_PLACEHOLDER = "TODO(confirmar-tally)";
export const TALLY_REPARA_URL = TALLY_REPARA_PLACEHOLDER;

/** Duración de la campaña Seiricon Go: meses gratis para reparaciones del sismo. */
export const MESES_GRATIS = 6;

/** Ciudades donde se reservan los meses gratis. No se verifica: se comunica (spec D6). */
export const CIUDADES_ELEGIBLES = ["Cali", "Pereira", "Manizales"];

/** "Cali, Pereira y Manizales" — derivado, para no repetir la frase en 4 componentes. */
export const CIUDADES_ELEGIBLES_TEXTO = CIUDADES_ELEGIBLES.slice(0, -1).join(", ")
  .concat(" y ", CIUDADES_ELEGIBLES[CIUDADES_ELEGIBLES.length - 1]);

// ─────────────────────────────────────────────────────────────────────────
// TODO(confirmar-vigencia): fecha límite para pedir el cupo, en texto ya
// formateado y en español (p. ej. "30 de septiembre de 2026"). Mientras siga
// en el placeholder, ReparaOferta NO muestra ninguna línea de vigencia: una
// fecha inventada en una campaña con vencimiento es una promesa falsa.
// ─────────────────────────────────────────────────────────────────────────
export const FECHA_LIMITE_PLACEHOLDER = "TODO(confirmar-vigencia)";
export const FECHA_LIMITE_CUPO = FECHA_LIMITE_PLACEHOLDER;

// ─────────────────────────────────────────────────────────────────────────
// TODO(confirmar-cupos) (OPCIONAL): si en algún momento hay un tope real de
// cupos, pon aquí el número. Déjalo en null para NO mostrar nada — es
// preferible no mostrar escasez a inventar un contador (mismo criterio que
// CUPOS_RESTANTES en src/components/beta/config.ts).
// ─────────────────────────────────────────────────────────────────────────
export const CUPOS_GO: number | null = null;

// Fuente única de los datos de contacto: viven en src/components/alerta/config.ts
// (verificados contra Footer.tsx, contacto/page.tsx y privacidad/page.tsx). Se
// reexportan para que los componentes de /repara importen solo de este archivo.
export {
  CONTACTO_EMAIL,
  CONTACTO_WHATSAPP,
  CONTACTO_WHATSAPP_PLACEHOLDER,
} from "@/components/alerta/config";
