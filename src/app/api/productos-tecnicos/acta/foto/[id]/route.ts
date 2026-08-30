import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/tenant";
import { CAMPOS_PUBLICOS, obtenerProducto } from "@/lib/productos-tecnicos/consultas";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";

/**
 * PATCH /api/productos-tecnicos/acta/foto/[id] — descarta (o recupera) una foto
 * del registro inicial.
 *
 * DESCARTAR NO ES BORRAR, y la diferencia es justamente lo que hay que
 * conservar: la fila sigue existiendo, el archivo sigue en el bucket y sigue
 * pesando en el cupo de la obra. Lo único que cambia es `vigente`, que es el
 * filtro con el que el acta escoge sus fotos. Una foto movida, borrosa o
 * repetida deja de entrar en el documento sin que desaparezca el rastro de que
 * se tomó — que es lo contrario de lo que haría un borrado y lo que permite
 * explicar después por qué el registro tiene un hueco.
 *
 * Se puede volver atrás (`descartada: false`) porque descartar por error no
 * puede costar una foto que ya no se puede repetir: el estado previo de un
 * inmueble solo existe una vez.
 *
 * Aquí no hay cadena de versiones que respetar —las fotos del registro nacen con
 * `reemplaza_a: null` y no se reemplazan—, así que esto no toca la invariante de
 * «una sola versión vigente» que gobierna los planos.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const { id } = await params;

    const producto = await obtenerProducto(ctx.constructoraId, id);
    if (!producto || producto.tipo !== "REGISTRO_INICIAL") {
      // Un plano pedido por esta ruta se responde igual que uno inexistente: no
      // tiene por qué enterarse de qué otros productos hay en la obra.
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    await assertObraAccesible(ctx, producto.proyecto_id);

    const cuerpo = (await req.json().catch(() => null)) as { descartada?: unknown } | null;
    if (typeof cuerpo?.descartada !== "boolean") {
      return NextResponse.json(
        { error: "Indica si la foto se descarta o se recupera." },
        { status: 400 },
      );
    }

    // El filtro de tenant viaja DENTRO de la escritura, no solo en la lectura
    // de arriba: es la misma regla que siguen las demás rutas del módulo, y la
    // que hace que un `id` ajeno no pueda escribir aunque alguien mueva el
    // orden de las guardas alguna vez.
    await prisma.productoTecnico.updateMany({
      where: { id: producto.id, proyecto: { constructora_id: ctx.constructoraId } },
      data: { vigente: !cuerpo.descartada },
    });

    const actualizado = await prisma.productoTecnico.findFirst({
      where: { id: producto.id, proyecto: { constructora_id: ctx.constructoraId } },
      select: CAMPOS_PUBLICOS,
    });

    return NextResponse.json({ producto: actualizado });
  } catch (error) {
    return respuestaDeError(error, "PATCH /api/productos-tecnicos/acta/foto/[id]");
  }
}
