import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/tenant";
import { CAMPOS_PUBLICOS, obtenerProducto, versionesDeObra } from "@/lib/productos-tecnicos/consultas";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import {
  cadenaDeVersiones,
  planificarCambioDeVigente,
  vigenteDeLaCadena,
} from "@/lib/productos-tecnicos/versionado";

/**
 * PATCH /api/productos-tecnicos/[id]/vigente
 *
 * Marca esta versión como la vigente de su plano y apaga las demás. Sirve para
 * volver atrás cuando la última subida fue un error — sin borrar nada: la
 * versión descartada sigue existiendo y sigue enlazada.
 *
 * El cambio va en una transacción por la misma razón que la subida: apagar y
 * encender por separado deja un instante con cero vigentes o con dos.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const { id } = await params;

    const producto = await obtenerProducto(ctx.constructoraId, id);
    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    await assertObraAccesible(ctx, producto.proyecto_id);

    const universo = await versionesDeObra(ctx.constructoraId, producto.proyecto_id);
    const cadena = cadenaDeVersiones(universo, id);
    const plan = planificarCambioDeVigente(cadena, id);

    await prisma.$transaction(async (tx) => {
      if (plan.aDesactivar.length > 0) {
        await tx.productoTecnico.updateMany({
          where: {
            id: { in: plan.aDesactivar },
            proyecto: { constructora_id: ctx.constructoraId },
          },
          data: { vigente: false },
        });
      }

      await tx.productoTecnico.updateMany({
        where: {
          id: plan.vigente,
          proyecto: { constructora_id: ctx.constructoraId },
        },
        data: { vigente: true },
      });
    });

    // Se relee y se comprueba la invariante: si quedó más de una vigente, es
    // mejor enterarse aquí que en la obra.
    const cadenaFinal = cadenaDeVersiones(
      await versionesDeObra(ctx.constructoraId, producto.proyecto_id),
      id,
    );
    vigenteDeLaCadena(cadenaFinal);

    const actualizado = await prisma.productoTecnico.findFirst({
      where: { id, proyecto: { constructora_id: ctx.constructoraId } },
      select: CAMPOS_PUBLICOS,
    });

    return NextResponse.json({
      producto: actualizado,
      versiones: cadenaFinal.map((v) => ({ id: v.id, version: v.version, vigente: v.vigente })),
    });
  } catch (error) {
    return respuestaDeError(error, "PATCH /api/productos-tecnicos/[id]/vigente");
  }
}
