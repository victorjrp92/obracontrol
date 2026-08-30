import { cadenaDeVersiones, type ProductoVersionado } from "@/lib/productos-tecnicos";

/**
 * Capa de PRESENTACIÓN del versionado de planos. El dominio
 * (`@/lib/productos-tecnicos/versionado.ts`) ya decide qué versión es la
 * vigente y garantiza que solo puede haber una por plano; aquí no se repite
 * esa lógica, solo se orquesta para pintarla:
 *
 *   - `agruparPlanos` parte el listado plano de una obra en sus planos
 *     individuales (cada uno, una cadena de versiones).
 *   - `ordenarParaVista` decide qué va primero en pantalla: la vigente,
 *     SIEMPRE, sin importar si es o no la de mayor número — volver a una
 *     versión anterior deja una vigente con un número menor que otras que
 *     siguen existiendo, apagadas, detrás.
 *
 * El desastre que existe para evitar es alguien construyendo sobre un plano
 * viejo. Si la vigente no está siempre en el mismo lugar prominente, ese
 * desastre sigue siendo posible.
 */

/** Lo que una fila de listado necesita además de lo que ya trae el dominio. */
export interface ProductoParaVista extends ProductoVersionado {
  nombre: string;
  pisoId: string | null;
  unidadId: string | null;
  /** ISO 8601, tal cual sale de `created_at`. Nunca se pierde en la vista. */
  fecha: string;
  subidoPorId: string;
  /** `null` si no se pudo resolver el nombre (usuario borrado, por ejemplo). */
  subidoPorNombre: string | null;
  /** "Obra completa" / "Piso 3" / "Apto 501", ya resuelto para no repetir el join en cada tarjeta. */
  ubicacionEtiqueta: string;
}

/** Una versión, lista para pintarse: nunca sin fecha ni sin autor. */
export interface VersionVista {
  id: string;
  version: number;
  vigente: boolean;
  nombre: string;
  fecha: string;
  subidoPor: string;
}

/** Un plano: su versión vigente al frente, el resto apagado detrás. */
export interface PlanoAgrupado {
  /** Id de la versión vigente — ancla estable mientras siga siendo la vigente. */
  id: string;
  nombre: string;
  pisoId: string | null;
  unidadId: string | null;
  ubicacionEtiqueta: string;
  versiones: VersionVista[];
}

const SIN_AUTOR = "Alguien que ya no está en el equipo";

function aVersionVista(p: ProductoParaVista): VersionVista {
  return {
    id: p.id,
    version: p.version,
    vigente: p.vigente,
    nombre: p.nombre,
    fecha: p.fecha,
    subidoPor: p.subidoPorNombre?.trim() || SIN_AUTOR,
  };
}

/**
 * Orden de pantalla: la vigente primero SIEMPRE. Debajo, el resto por número
 * de versión descendente — lo más reciente arriba, aunque no sea la vigente.
 */
export function ordenarParaVista(cadena: readonly ProductoParaVista[]): VersionVista[] {
  return cadena
    .map(aVersionVista)
    .sort((a, b) => (a.vigente !== b.vigente ? (a.vigente ? -1 : 1) : b.version - a.version));
}

/**
 * Parte el universo de PLANOs (o RENDERs) de una obra en sus productos
 * individuales. Por invariante del dominio cada uno tiene EXACTAMENTE una
 * versión vigente (`vigenteDeLaCadena` la garantiza donde se decide, no
 * aquí) — agrupar es partir por cada vigente y reconstruir su cadena con
 * `cadenaDeVersiones`, que es el mismo código que usa la API.
 */
export function agruparPlanos(productos: readonly ProductoParaVista[]): PlanoAgrupado[] {
  const vigentes = productos.filter((p) => p.vigente);
  return vigentes
    .map((v) => {
      // `cadenaDeVersiones` devuelve las MISMAS referencias que recibió, así
      // que el cast es seguro: los campos de vista siguen ahí en runtime.
      const cadena = cadenaDeVersiones(productos, v.id) as ProductoParaVista[];
      return {
        id: v.id,
        nombre: v.nombre,
        pisoId: v.pisoId,
        unidadId: v.unidadId,
        ubicacionEtiqueta: v.ubicacionEtiqueta,
        versiones: ordenarParaVista(cadena),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Un render, listo para pintarse. Los renders también versionan (comparten
 * el mismo mecanismo que los planos: `reemplazar` es subir sobre el
 * vigente), pero la pantalla solo necesita la vigente — el histórico de
 * renders no se navega igual que el de planos, así que no se agrupa en
 * cadena aquí.
 */
export interface RenderVista {
  id: string;
  nombre: string;
  pisoId: string | null;
  unidadId: string | null;
  fecha: string;
  subidoPor: string;
  ubicacionEtiqueta: string;
}

/** Las versiones vigentes de tipo RENDER, listas para pintarse en la grilla. */
export function renderesVigentes(productos: readonly ProductoParaVista[]): RenderVista[] {
  return productos
    .filter((p) => p.vigente)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      pisoId: p.pisoId,
      unidadId: p.unidadId,
      fecha: p.fecha,
      subidoPor: p.subidoPorNombre?.trim() || SIN_AUTOR,
      ubicacionEtiqueta: p.ubicacionEtiqueta,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
