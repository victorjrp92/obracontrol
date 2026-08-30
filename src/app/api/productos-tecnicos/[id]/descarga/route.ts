import { NextResponse } from "next/server";
import { getSignedEvidenciaUrl } from "@/lib/storage";
import { requireUser } from "@/lib/tenant";
import { obtenerProducto } from "@/lib/productos-tecnicos/consultas";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import { rutaPerteneceAObra } from "@/lib/productos-tecnicos/ruta";

/**
 * Cinco minutos. El archivo se abre en el momento en que se pide la URL; una
 * firma de horas es una URL que sigue sirviendo después de reenviarla por
 * WhatsApp, y estos son los planos de una obra ajena.
 */
const SEGUNDOS_VALIDEZ = 300;

/**
 * GET /api/productos-tecnicos/[id]/descarga
 *
 * Devuelve una URL firmada temporal. El `storage_path` NO se expone nunca: si
 * saliera, cualquiera podría intentar construir rutas del bucket a mano.
 */
export async function GET(
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

    // El path sale de la base, pero se comprueba igual: firmar a ciegas
    // convertiría una fila corrupta en una URL a un objeto arbitrario del
    // bucket — donde también viven las evidencias de otras obras.
    if (!rutaPerteneceAObra(producto.storage_path, producto.proyecto_id)) {
      console.error(
        `Producto ${producto.id}: storage_path fuera del prefijo de su obra`,
      );
      return NextResponse.json({ error: "Archivo no disponible" }, { status: 409 });
    }

    const url = await getSignedEvidenciaUrl(producto.storage_path, SEGUNDOS_VALIDEZ);
    if (!url) {
      return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 502 });
    }

    return NextResponse.json({
      url,
      expira_en_segundos: SEGUNDOS_VALIDEZ,
      nombre: producto.nombre,
      mime: producto.mime,
      bytes: producto.bytes,
      version: producto.version,
      vigente: producto.vigente,
    });
  } catch (error) {
    return respuestaDeError(error, "GET /api/productos-tecnicos/[id]/descarga");
  }
}
