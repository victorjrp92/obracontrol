import { randomBytes } from "crypto";

/**
 * ─── Tokens de acceso público (sin login) ────────────────────────────────────
 *
 * Fuente única de los tokens que dan acceso a `/o/[token]` (obrero) y
 * `/c/[token]` (cliente). Ambas rutas son la ÚNICA credencial de quien las
 * usa: quien tenga el enlace, entra. Por eso el token tiene que ser
 * impredecible de verdad.
 *
 * NO usar `cuid()` para esto. Un cuid está pensado para ser un identificador
 * único y ordenable, no un secreto: incorpora la marca de tiempo, un contador
 * secuencial y una huella del proceso, y deja muy pocos caracteres al azar.
 * Con un solo token válido a la vista —el de un obrero cualquiera, o el de una
 * cuenta de prueba— el resto del espacio se recorre por fuerza bruta.
 *
 * 24 bytes de `randomBytes` = 192 bits de entropía, en 32 caracteres urlsafe
 * (base64url: sin `+`, `/` ni `=`, así que viaja limpio en una URL y en un
 * mensaje de WhatsApp).
 */

/** Bytes de aleatoriedad por token. 24 → 32 caracteres base64url. */
const BYTES_TOKEN = 24;

/**
 * Genera un token de acceso público criptográficamente aleatorio.
 * Úsalo para CUALQUIER token que funcione como credencial sin sesión.
 */
export function generarTokenAcceso(): string {
  return randomBytes(BYTES_TOKEN).toString("base64url");
}

/**
 * Forma esperada de un token nuevo. Sirve para descartar basura evidente
 * ANTES de ir a la base de datos: un escaneo de fuerza bruta que manda
 * cadenas cortas o con caracteres raros se corta sin gastar una consulta.
 *
 * Deliberadamente permisiva en el largo (16-64) para no invalidar los tokens
 * legados —cuid de 25 caracteres y los tokens fijos de los seeds— mientras se
 * completa la rotación.
 */
const FORMA_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** ¿El token tiene una forma plausible? No dice nada de si existe. */
export function tokenTieneFormaValida(token: string): boolean {
  return FORMA_TOKEN.test(token);
}
