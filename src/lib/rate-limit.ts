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

// ─── Freno de carga de las rutas de token público ───────────────────────────
//
// `/o/[token]` (obrero) y `/c/[token]` (cliente) usan el token como credencial
// completa. La primera versión de esto contaba tokens FALLIDOS por IP y
// bloqueaba a los 10. Era un error, por dos razones:
//
//  1. Adivinar ya es imposible. Desde que los tokens se generan con
//     `generarTokenAcceso()` son 192 bits de aleatoriedad real; no hay fuerza
//     bruta que sirva, con o sin freno. La defensa contra adivinación es la
//     entropía, no el contador.
//  2. El contador SÍ negaba tokens VÁLIDOS. Como el bloqueo se evaluaba antes
//     de consultar, una vez que una IP gastaba su presupuesto quedaba fuera
//     durante diez minutos aunque su enlace fuera correcto. Y detrás de una IP
//     hay muchísima gente: los operadores móviles colombianos comparten IPv4
//     pública entre miles de suscriptores por CGNAT. Un cliente recargando un
//     enlace caducado cuatro o cinco veces podía dejar sin acceso a una obra
//     entera, sin ningún mensaje que permitiera diagnosticarlo.
//
// Lo que queda protege lo único que seguía en riesgo: que un escáner martillee
// la base de datos. Es un tope de PETICIONES, no de fallos, y es deliberadamente
// generoso — detrás de una IP de CGNAT puede haber una obra completa
// trabajando. Un humano no se acerca; un script se estrella enseguida.
//
// Un token válido SIEMPRE funciona mientras la IP esté por debajo del tope.

/** Peticiones por minuto y por IP contra las rutas de token público. */
const MAX_PETICIONES_TOKEN_POR_MINUTO = 120;

/**
 * ¿Se admite esta petición contra una ruta de token? Generoso a propósito:
 * ver la nota de arriba. Devuelve `true` si no hay IP (fuera de una petición).
 */
export function permitirPeticionDeToken(clave: string | null): boolean {
  if (!clave) return true;
  return permitirPeticion(`token:${clave}`, MAX_PETICIONES_TOKEN_POR_MINUTO);
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
  } catch (err) {
    // Fuera de una petición (un script de seed) esto es normal y `null` es la
    // respuesta correcta. Pero si `headers()` falla por CUALQUIER otra razón,
    // el freno se apaga sin dejar rastro — y un control silenciosamente
    // desactivado es peor que no tenerlo. Por eso deja constancia.
    if (process.env.NODE_ENV === "production") {
      console.warn("claveDeSolicitud: sin contexto de petición, el freno de token queda inactivo", err);
    }
    return null;
  }
}
