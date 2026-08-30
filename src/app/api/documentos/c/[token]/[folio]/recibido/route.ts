import { NextRequest, NextResponse } from "next/server";
import { validarClienteToken } from "@/lib/data-cliente";
import {
  dejarConstanciaDeRecibido,
  documentoParaCliente,
  esFolioDeFamilia,
  normalizarFolio,
  type PrefijoFolio,
} from "@/lib/documentos";
import { respuestaDeFalla } from "../../../../_fallas";

/**
 * El «recibido conforme» del cliente, por el enlace sin cuenta.
 *
 * PÚBLICA a propósito: el cliente de una obra no tiene ni va a tener cuenta. La
 * credencial es el token del enlace, el MISMO mecanismo de `/c/[token]` que ya
 * existía, sin inventar otro:
 *
 *   · `generarTokenAcceso()` — 24 bytes de `randomBytes`, 192 bits en 32
 *     caracteres urlsafe. No es un `cuid`, que lleva marca de tiempo y contador
 *     y deja poquísimo al azar. Adivinar uno no es un problema de paciencia.
 *   · `tokenTieneFormaValida()` — descarta la basura antes de tocar la base, así
 *     un escaneo no gasta una consulta por intento.
 *   · `permitirPeticionDeToken()` — freno de CARGA por IP. Es un tope de
 *     peticiones y no de fallos, a propósito: la versión anterior contaba fallos
 *     y dejaba fuera a obras enteras detrás de una IP compartida por CGNAT, sin
 *     proteger de nada que la entropía no protegiera ya.
 *
 * Los tres van dentro de `validarClienteToken()`, que es el único camino de aquí
 * a un proyecto. Y el `proyectoId` que devuelve acota todo lo demás: un folio de
 * otra obra no llega ni a compararse.
 */

/** AE — acta de estado inicial · CT — concepto técnico. */
const PREFIJOS_PROFESIONAL: readonly PrefijoFolio[] = ["AE", "CT"];

type Contexto = { params: Promise<{ token: string; folio: string }> };

/** Resuelve token + folio, o devuelve la respuesta de error que corresponda. */
async function resolver(ctx: Contexto) {
  const { token, folio: folioCrudo } = await ctx.params;

  const valido = await validarClienteToken(token);
  if (!valido) {
    // 410 Gone: el enlace existió y fue revocado, o nunca fue válido. La misma
    // respuesta para los dos casos.
    return { error: NextResponse.json({ error: "Enlace no válido o desactivado" }, { status: 410 }) };
  }

  const folio = normalizarFolio(folioCrudo ?? "");
  if (!esFolioDeFamilia(folio, PREFIJOS_PROFESIONAL)) {
    return { error: NextResponse.json({ error: "Documento no encontrado" }, { status: 404 }) };
  }

  return { folio, proyectoId: valido.proyectoId };
}

/** GET — el documento tal como lo ve el cliente. Solo lo que el PDF ya muestra. */
export async function GET(_req: NextRequest, ctx: Contexto) {
  try {
    const resuelto = await resolver(ctx);
    if (resuelto.error) return resuelto.error;

    return NextResponse.json(await documentoParaCliente(resuelto.folio, resuelto.proyectoId));
  } catch (err) {
    const falla = respuestaDeFalla(err);
    if (falla) return falla;
    console.error("GET /api/documentos/c/[token]/[folio]/recibido: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST — deja la constancia de ENTREGA.
 *
 * Lo que se registra es que el documento llegó, a quién y cuándo. No es una
 * aprobación del contenido, y el texto que el cliente lee antes de pulsar lo
 * dice con esas palabras (`COPY_RECIBIDO` en `lenguaje.ts`).
 */
export async function POST(req: NextRequest, ctx: Contexto) {
  try {
    const resuelto = await resolver(ctx);
    if (resuelto.error) return resuelto.error;

    const cuerpo = (await req.json().catch(() => ({}))) as { receptor?: unknown };
    const receptor = typeof cuerpo.receptor === "string" ? cuerpo.receptor : null;

    const vista = await dejarConstanciaDeRecibido(resuelto.folio, resuelto.proyectoId, receptor);
    return NextResponse.json(vista, { status: 201 });
  } catch (err) {
    const falla = respuestaDeFalla(err);
    if (falla) return falla;
    console.error("POST /api/documentos/c/[token]/[folio]/recibido: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
