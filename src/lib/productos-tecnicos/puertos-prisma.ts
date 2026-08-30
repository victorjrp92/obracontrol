import { prisma } from "@/lib/prisma";
import type { ProductoVersionado, PuertosSubida, Ubicacion } from "./tipos";

/**
 * Las implementaciones reales de los tres puertos de `prepararSubida`.
 *
 * Los tres se construyen con un `constructoraId` y lo llevan metido en el
 * `where`. El aislamiento por tenant vive AQUÍ, no en el dominio: así no
 * existe manera de llamar a un puerto «sin tenant», ni siquiera por
 * descuido — la firma no lo permite.
 */
export function puertosPrisma(constructoraId: string): PuertosSubida {
  return {
    /**
     * Suma de bytes de la obra.
     *
     * FÍJATE EN LO QUE NO HAY: no hay `vigente: true` en el `where`. Las
     * versiones reemplazadas no se borran nunca, así que siguen ocupando su
     * espacio y tienen que contar. Filtrar por vigencia aquí haría que el cupo
     * bajara solo cada vez que alguien sube una versión nueva.
     */
    async bytesUsadosEnObra(proyectoId: string): Promise<number> {
      const agregado = await prisma.productoTecnico.aggregate({
        _sum: { bytes: true },
        where: {
          proyecto_id: proyectoId,
          proyecto: { constructora_id: constructoraId },
        },
      });
      return agregado._sum.bytes ?? 0;
    },

    async ubicacionPertenece(ubicacion: Ubicacion): Promise<boolean> {
      const obras = await prisma.proyecto.count({
        where: { id: ubicacion.proyectoId, constructora_id: constructoraId },
      });
      if (obras === 0) return false;

      if (ubicacion.pisoId) {
        const pisos = await prisma.piso.count({
          where: {
            id: ubicacion.pisoId,
            edificio: { proyecto_id: ubicacion.proyectoId },
          },
        });
        return pisos > 0;
      }

      if (ubicacion.unidadId) {
        const unidades = await prisma.unidad.count({
          where: {
            id: ubicacion.unidadId,
            piso: { edificio: { proyecto_id: ubicacion.proyectoId } },
          },
        });
        return unidades > 0;
      }

      return true;
    },

    async buscarProducto(id: string): Promise<ProductoVersionado | null> {
      return prisma.productoTecnico.findFirst({
        where: { id, proyecto: { constructora_id: constructoraId } },
        select: {
          id: true,
          proyecto_id: true,
          tipo: true,
          version: true,
          vigente: true,
          reemplaza_a: true,
        },
      });
    },
  };
}
