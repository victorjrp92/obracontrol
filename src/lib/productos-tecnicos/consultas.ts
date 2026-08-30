import type { Prisma, TipoProductoTecnico } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { ProductoVersionado } from "./tipos";

/**
 * Lecturas del módulo. Todas arrancan por `proyecto: { constructora_id }`:
 * el filtro de tenant es parte del `where`, no un `if` posterior que se pueda
 * olvidar en la siguiente consulta que alguien añada.
 *
 * `storage_path` NO se devuelve nunca en un listado. Es la ruta interna del
 * bucket y no le sirve a nadie fuera del servidor; para ver el archivo está la
 * ruta de descarga, que firma una URL temporal. Sacarlo del listado quita de
 * en medio la tentación de construir URLs a mano en el front.
 */
export const CAMPOS_PUBLICOS = {
  id: true,
  proyecto_id: true,
  piso_id: true,
  unidad_id: true,
  tipo: true,
  nombre: true,
  descripcion: true,
  mime: true,
  bytes: true,
  version: true,
  vigente: true,
  reemplaza_a: true,
  subido_por_id: true,
  created_at: true,
} satisfies Prisma.ProductoTecnicoSelect;

export interface FiltroListado {
  constructoraId: string;
  proyectoId: string;
  tipo?: TipoProductoTecnico | null;
  pisoId?: string | null;
  unidadId?: string | null;
  /** `false` (por defecto) devuelve solo la versión vigente de cada plano. */
  incluirHistorico?: boolean;
}

export async function listarProductos(filtro: FiltroListado) {
  return prisma.productoTecnico.findMany({
    where: {
      proyecto_id: filtro.proyectoId,
      proyecto: { constructora_id: filtro.constructoraId },
      ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
      ...(filtro.pisoId ? { piso_id: filtro.pisoId } : {}),
      ...(filtro.unidadId ? { unidad_id: filtro.unidadId } : {}),
      ...(filtro.incluirHistorico ? {} : { vigente: true }),
    },
    select: CAMPOS_PUBLICOS,
    orderBy: [{ tipo: "asc" }, { created_at: "desc" }],
  });
}

/** Un producto por id, ya filtrado por tenant. Incluye `storage_path`. */
export async function obtenerProducto(constructoraId: string, id: string) {
  return prisma.productoTecnico.findFirst({
    where: { id, proyecto: { constructora_id: constructoraId } },
    select: { ...CAMPOS_PUBLICOS, storage_path: true },
  });
}

/**
 * Todas las versiones de una obra, con lo justo para reconstruir cadenas.
 *
 * Se traen todas y se arma la cadena en memoria en vez de hacer un CTE
 * recursivo: una obra tiene decenas de productos, no millones, y la lógica de
 * la cadena queda en `versionado.ts`, donde se puede verificar sin base.
 */
export async function versionesDeObra(
  constructoraId: string,
  proyectoId: string,
): Promise<ProductoVersionado[]> {
  return prisma.productoTecnico.findMany({
    where: {
      proyecto_id: proyectoId,
      proyecto: { constructora_id: constructoraId },
    },
    select: {
      id: true,
      proyecto_id: true,
      tipo: true,
      version: true,
      vigente: true,
      reemplaza_a: true,
    },
  });
}
