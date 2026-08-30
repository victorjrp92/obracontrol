import type { TipoProductoTecnico } from "@/generated/prisma";
import { fallar } from "./errores";
import type { PlanVersion, ProductoVersionado } from "./tipos";

/**
 * Versionado de productos técnicos.
 *
 * El desastre clásico de obra es alguien construyendo sobre un plano viejo.
 * De ahí salen las dos reglas, y las dos tiran en direcciones opuestas a
 * propósito:
 *
 *   1. SOLO UNA versión vigente por plano. Si hay dos «vigentes» a la vez, la
 *      cuadrilla imprime la que le tocó y el sistema no sirvió para nada.
 *   2. LA ANTERIOR NUNCA SE BORRA. Queda con `vigente: false` y enlazada por
 *      `reemplaza_a`. Es lo que permite demostrar meses después qué plano
 *      estaba vigente el día que se fundió la losa — que es exactamente la
 *      pregunta que se hace cuando algo salió mal.
 *
 * Aquí no se escribe nada: se decide qué escribir. Quien llame ejecuta el plan
 * en UNA transacción, porque desactivar la anterior y crear la nueva por
 * separado deja una ventana con cero vigentes o con dos.
 */

/**
 * Qué versión le toca a un archivo nuevo.
 *
 * `anterior` es el producto que se declaró reemplazar (`null` si es la primera
 * versión de un plano nuevo). Las tres guardas son de integridad, y una de
 * ellas también es de tenant: no se reemplaza un producto de otra obra.
 */
export function planificarNuevaVersion(
  destino: { proyectoId: string; tipo: TipoProductoTecnico },
  anterior: ProductoVersionado | null,
): PlanVersion {
  if (!anterior) {
    return { version: 1, reemplazaA: null, aDesactivar: [] };
  }

  if (anterior.proyecto_id !== destino.proyectoId) {
    fallar(
      400,
      "VERSION_INVALIDA",
      "No se puede reemplazar un producto que pertenece a otra obra.",
    );
  }

  if (anterior.tipo !== destino.tipo) {
    fallar(
      400,
      "VERSION_INVALIDA",
      "Una versión nueva tiene que ser del mismo tipo que la que reemplaza.",
    );
  }

  if (!anterior.vigente) {
    fallar(
      400,
      "VERSION_INVALIDA",
      "Ese producto ya fue reemplazado. Sube la versión nueva sobre la que está vigente.",
    );
  }

  return {
    version: anterior.version + 1,
    reemplazaA: anterior.id,
    aDesactivar: [anterior.id],
  };
}

/**
 * Todas las versiones de un mismo plano, ordenadas de la 1 en adelante.
 *
 * La cadena se reconstruye caminando `reemplaza_a` hacia atrás y buscando
 * quién apunta a cada nodo hacia adelante, partiendo de cualquier versión.
 * `productos` es el universo donde buscar (ya filtrado por tenant y por obra).
 */
export function cadenaDeVersiones(
  productos: readonly ProductoVersionado[],
  idSemilla: string,
): ProductoVersionado[] {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const semilla = porId.get(idSemilla);
  if (!semilla) return [];

  const cadena = new Map<string, ProductoVersionado>([[semilla.id, semilla]]);

  // Hacia atrás: la versión que esta reemplaza, y así hasta la primera.
  let cursor: ProductoVersionado | undefined = semilla;
  while (cursor?.reemplaza_a) {
    const previo: ProductoVersionado | undefined = porId.get(cursor.reemplaza_a);
    // Sin `previo` la cadena está rota (la anterior se borró a mano o es de
    // otra obra): se corta en vez de fingir que no existía.
    if (!previo || cadena.has(previo.id)) break;
    cadena.set(previo.id, previo);
    cursor = previo;
  }

  // Hacia adelante: quien apunte a algo que ya está en la cadena, entra.
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const p of productos) {
      if (cadena.has(p.id)) continue;
      if (p.reemplaza_a && cadena.has(p.reemplaza_a)) {
        cadena.set(p.id, p);
        crecio = true;
      }
    }
  }

  return [...cadena.values()].sort((a, b) => a.version - b.version);
}

/**
 * La única versión vigente de la cadena.
 *
 * Lanza si hay más de una: es la invariante del módulo y una violación no se
 * puede resolver adivinando cuál gana.
 */
export function vigenteDeLaCadena(
  cadena: readonly ProductoVersionado[],
): ProductoVersionado | null {
  const vigentes = cadena.filter((p) => p.vigente);
  if (vigentes.length > 1) {
    fallar(
      500,
      "VERSION_INVALIDA",
      `Este plano tiene ${vigentes.length} versiones marcadas como vigentes. Solo puede haber una.`,
    );
  }
  return vigentes[0] ?? null;
}

/**
 * Qué escribir para dejar vigente la versión `idObjetivo`.
 *
 * Sirve para volver atrás cuando la última subida fue un error: la versión 2 se
 * apaga y la 1 se enciende, sin que ninguna deje de existir.
 */
export function planificarCambioDeVigente(
  cadena: readonly ProductoVersionado[],
  idObjetivo: string,
): { vigente: string; aDesactivar: string[] } {
  const objetivo = cadena.find((p) => p.id === idObjetivo);
  if (!objetivo) {
    fallar(404, "NO_ENCONTRADO", "Esa versión no existe en este plano.");
  }

  return {
    vigente: objetivo.id,
    aDesactivar: cadena.filter((p) => p.id !== objetivo.id && p.vigente).map((p) => p.id),
  };
}
