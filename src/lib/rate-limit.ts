/**
 * Rate limit en memoria por clave (normalmente la IP). Ventana deslizante
 * simple: N peticiones por clave por ventana.
 *
 * En memoria a propósito: las rutas que lo usan no tienen tenant ni sesión, y
 * no queremos otra tabla con IPs. En serverless cada instancia tiene su propio
 * mapa — el límite es por instancia.
 *
 * ⚠️ LÍMITE CONOCIDO: esto frena un script casero, no a alguien decidido. Como
 * Vercel crea instancias nuevas bajo carga y cada una arranca con el mapa
 * vacío, el techo global efectivo se multiplica justo durante un pico. Para un
 * control que aguante hace falta un contador compartido (Redis o tabla con
 * TTL). Ver docs/seguridad.md.
 *
 * Vivía en `src/lib/juntos/rate-limit.ts`; se subió a `src/lib/` cuando las
 * rutas de token público (`/o/[token]`, `/c/[token]`) también lo necesitaron.
 */

const ventanas = new Map<string, number[]>();

/** Tope de claves vivas: si algo lo desborda (scan distribuido), se vacía el
 *  mapa entero antes que crecer sin límite. Preferimos perder el contador a
 *  perder memoria. */
const MAX_CLAVES = 5000;

export function permitirPeticion(clave: string, maxPorVentana: number, ventanaMs = 60_000): boolean {
  const ahora = Date.now();
  const desde = ahora - ventanaMs;

  if (ventanas.size > MAX_CLAVES) ventanas.clear();

  const marcas = (ventanas.get(clave) ?? []).filter((t) => t > desde);
  if (marcas.length >= maxPorVentana) {
    ventanas.set(clave, marcas);
    return false;
  }
  marcas.push(ahora);
  ventanas.set(clave, marcas);
  return true;
}

/** IP best-effort detrás del proxy de Vercel/Next. Nunca se persiste ni se loguea. */
export function claveDesdeHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "sin-ip";
}

// ─── Fuerza bruta contra tokens públicos ────────────────────────────────────
//
// Las rutas `/o/[token]` (obrero) y `/c/[token]` (cliente) usan el token como
// credencial completa: quien acierte uno, entra. La defensa es contar SOLO los
// intentos FALLIDOS. Así un obrero real —que siempre acierta— nunca se topa
// con el límite por más que recargue, mientras que quien va probando tokens
// agota su presupuesto en segundos.

/** Fallos tolerados por IP antes de cerrar la puerta. Amplio para un humano que
 *  pegó mal el enlace; asfixiante para un script. */
const MAX_FALLOS_TOKEN = 10;
/** Ventana de los fallos: 10 minutos. */
const VENTANA_FALLOS_MS = 10 * 60_000;

const fallosToken = new Map<string, number[]>();

/** ¿Esta IP ya gastó su presupuesto de tokens fallidos? */
export function bloqueadoPorFallosDeToken(clave: string): boolean {
  const desde = Date.now() - VENTANA_FALLOS_MS;
  const marcas = (fallosToken.get(clave) ?? []).filter((t) => t > desde);
  fallosToken.set(clave, marcas);
  return marcas.length >= MAX_FALLOS_TOKEN;
}

/** Anota un token inválido para esta IP. Llamar SOLO cuando el token no existe. */
export function registrarFalloDeToken(clave: string): void {
  if (fallosToken.size > MAX_CLAVES) fallosToken.clear();
  const desde = Date.now() - VENTANA_FALLOS_MS;
  const marcas = (fallosToken.get(clave) ?? []).filter((t) => t > desde);
  marcas.push(Date.now());
  fallosToken.set(clave, marcas);
}

/**
 * IP de la petición en curso, leída del contexto del servidor. Sirve para
 * aplicar el freno DENTRO de los validadores de token (que no reciben el
 * `Request`), y así cubrir de una vez las rutas de API y las páginas.
 *
 * Devuelve `null` fuera de una petición —por ejemplo en un script de seed—,
 * donde el freno simplemente no aplica.
 */
export async function claveDeSolicitud(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    return claveDesdeHeaders(await headers());
  } catch {
    return null;
  }
}
