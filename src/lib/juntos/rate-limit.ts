/**
 * Rate limit en memoria por clave (normalmente la IP) para las rutas API
 * públicas de «Juntos» y las de /api/alerta que Juntos monta. Ventana
 * deslizante simple: N peticiones por clave por ventana.
 *
 * En memoria a propósito (spec-go-juntos.md, sección Seguridad): estas rutas
 * no tienen tenant ni sesión, y no queremos otra tabla con IPs. En serverless
 * cada instancia tiene su propio mapa — el límite es por instancia, que es
 * suficiente como freno de abuso básico para este flujo.
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
