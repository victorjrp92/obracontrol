import type { ProductoApi } from "./api-productos-tecnicos";
import { etiquetaDeUbicacion, type EdificioOpcion } from "./ubicaciones";
import type { ProductoParaVista } from "./vista-planos";

/**
 * `ProductoApi` (lo que devuelve la API, sin nombres resueltos) → lo que
 * necesita la vista. Es el único sitio donde las dos formas se tocan, para
 * que agregar un campo a la vista no obligue a tocar cada `.map()` suelto.
 */
export function aProductoParaVista(
  p: ProductoApi,
  opciones: { nombrePorId: ReadonlyMap<string, string>; edificios: readonly EdificioOpcion[] },
): ProductoParaVista {
  return {
    id: p.id,
    proyecto_id: p.proyecto_id,
    tipo: p.tipo,
    version: p.version,
    vigente: p.vigente,
    reemplaza_a: p.reemplaza_a,
    nombre: p.nombre,
    pisoId: p.piso_id,
    unidadId: p.unidad_id,
    fecha: p.created_at,
    subidoPorId: p.subido_por_id,
    subidoPorNombre: opciones.nombrePorId.get(p.subido_por_id) ?? null,
    ubicacionEtiqueta: etiquetaDeUbicacion(opciones.edificios, p.piso_id, p.unidad_id),
  };
}
