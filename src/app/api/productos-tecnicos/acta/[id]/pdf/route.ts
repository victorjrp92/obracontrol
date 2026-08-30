import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  almacenPerfilFirma,
  almacenPrisma,
  hashContenido,
  hashCorto,
  momentoEnColombia,
} from "@/lib/documentos";
import { ActaEstadoInicialReport } from "@/lib/pdf/ActaEstadoInicialReport";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import { rutaPerteneceAObra } from "@/lib/productos-tecnicos/ruta";
import { permitirPeticion } from "@/lib/rate-limit";
import { requireUser } from "@/lib/tenant";
import {
  fotosEnOrden,
  leerContenidoActa,
} from "@/components/productos-tecnicos/logica/acta-estado-inicial";
import { fotoComoDataUrl, leerSnapshotActa } from "../../_almacen-acta";

/**
 * GET /api/productos-tecnicos/acta/[id]/pdf — imprime un acta ya emitida.
 *
 * Imprime SIEMPRE desde la copia congelada al emitir, nunca reconstruyendo el
 * contenido desde la base. Y antes de dibujar nada vuelve a calcular la huella
 * sobre esa copia y la compara con la que está registrada: si no coinciden, el
 * documento no se imprime. Un PDF que llevara impreso un sello de verificación
 * que no coteja es peor que no tener PDF — el sello es lo único que hace útil el
 * documento, y entregarlo roto le explota a quien lo presenta, no a nosotros.
 *
 * La firma escaneada y el momento de la firma se añaden al imprimir y no entran
 * en la huella: ocurren después de emitir. Se verifican por su lado, en
 * `GET /api/documentos/verificar`, que responde quién firmó, cuándo y bajo qué
 * matrícula.
 */
export const maxDuration = 60;

/**
 * Freno por usuario.
 *
 * Es la ruta más cara del módulo con diferencia: descarga hasta cien imágenes y
 * arma el PDF entero en memoria. La sesión ya limita quién puede pedirlo, pero
 * una pestaña recargando en bucle basta para comerse los minutos de la función.
 * Doce por minuto son de sobra para cualquier uso real.
 */
const MAX_PDF_POR_MINUTO = 12;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    if (!permitirPeticion(`acta-pdf:${ctx.usuarioId}`, MAX_PDF_POR_MINUTO)) {
      return NextResponse.json(
        { error: "Demasiadas descargas seguidas. Espera un minuto e intenta de nuevo." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    const { id } = await params;

    const doc = await almacenPrisma.porId(id);
    if (!doc || doc.tipo !== "ACTA_ESTADO_INICIAL" || !doc.proyecto_id) {
      return NextResponse.json({ error: "Acta no encontrada" }, { status: 404 });
    }
    await assertObraAccesible(ctx, doc.proyecto_id);

    const snapshot = await leerSnapshotActa(doc.proyecto_id, doc.folio);
    if (!snapshot) {
      return NextResponse.json(
        {
          error:
            "Esta acta quedó registrada sin su contenido y no se puede imprimir. Emite una nueva.",
          codigo: "SIN_CONTENIDO",
        },
        { status: 409 },
      );
    }

    if (hashContenido(snapshot.contenido, doc.folio) !== doc.hash) {
      console.error("GET /api/productos-tecnicos/acta/[id]/pdf: huella del contenido no coteja");
      return NextResponse.json(
        {
          error:
            "El contenido guardado de esta acta no coincide con su huella registrada. " +
            "No la imprimimos: el sello de verificación no cotejaría.",
          codigo: "CONTENIDO_ALTERADO",
        },
        { status: 409 },
      );
    }

    const payload = leerContenidoActa(snapshot.contenido);
    if (!payload) {
      return NextResponse.json(
        { error: "El contenido de esta acta no se puede leer.", codigo: "SIN_CONTENIDO" },
        { status: 409 },
      );
    }

    // ── Fotos ──────────────────────────────────────────────────────────────
    // Cada ruta se comprueba contra la obra ANTES de firmar la descarga: el path
    // sale de un JSON del bucket, y descargarlo sin mirar convertiría un archivo
    // manipulado en una vía para leer cualquier objeto —incluidas evidencias de
    // otra obra— y estamparlo dentro de un documento.
    const imagenes: Record<string, string> = {};
    for (const foto of fotosEnOrden(payload)) {
      const ruta = snapshot.rutas[foto.productoId];
      if (!ruta || !rutaPerteneceAObra(ruta, doc.proyecto_id)) continue;
      const dataUrl = await fotoComoDataUrl(ruta);
      if (dataUrl) imagenes[foto.productoId] = dataUrl;
    }

    // ── Firma ──────────────────────────────────────────────────────────────
    // Solo si el acta está firmada, y solo la de QUIEN firmó. Pintar la imagen
    // de quien está mirando la pantalla sería estampar una firma que nadie puso.
    let firmaDataUrl: string | null = null;
    if (doc.firmado_por_id && doc.firmado_el) {
      const perfil = await almacenPerfilFirma.leer(doc.firmado_por_id);
      if (perfil.imagenPath) firmaDataUrl = await fotoComoDataUrl(perfil.imagenPath);
    }

    const pdf = await renderToBuffer(
      ActaEstadoInicialReport({
        payload,
        folio: doc.folio,
        huellaCorta: hashCorto(doc.hash),
        logoDataUrl: logoSeiriconDataUrl(),
        imagenes,
        firmaDataUrl,
        firmadoMomento: doc.firmado_el ? momentoEnColombia(doc.firmado_el) : null,
      }),
    );

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="acta-estado-inicial-${doc.folio}.pdf"`,
        // Un acta firmada no cambia; una sin firmar sí, cuando se firme. En los
        // dos casos conviene que el navegador no sirva una copia vieja.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return respuestaDeError(error, "GET /api/productos-tecnicos/acta/[id]/pdf");
  }
}
