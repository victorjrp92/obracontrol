import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ActaJuntosReport } from "@/lib/pdf/ActaJuntosReport";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { generarFolio, hashContenido, hashCorto } from "@/lib/juntos/folio";
import {
  MAX_BODY_BYTES,
  mensajeActaJuntosMuyPesada,
  validarActaJuntosPayload,
} from "@/lib/juntos/acta-juntos";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";
import { ESPERA_SUGERIDA_SEGUNDOS, MENSAJE_SIN_CUPO, soltarCupo, tomarCupo } from "@/lib/juntos/compuerta";

/**
 * POST /api/juntos/acta-pdf — genera y devuelve el Acta de documentación de
 * daños de «Juntos». Público, sin auth, SIN PERSISTENCIA de ningún tipo.
 *
 * REGLA DURA (spec-go-juntos.md): la cédula y la dirección del inmueble
 * ENTRAN en este request, se IMPRIMEN en el PDF y se DESCARTAN al responder.
 * No se escriben en base de datos, ni en logs, ni en ningún otro lado — por
 * eso ningún `catch` de esta ruta serializa el body ni el error.
 */
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 6;

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeActaJuntosMuyPesada() }, { status: 413 });
    }

    if (!permitirPeticion(`juntos-acta:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json(
        { error: "Estamos recibiendo muchas solicitudes desde tu conexión. Espera un minuto e intenta de nuevo." },
        { status: 429 }
      );
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeActaJuntosMuyPesada() }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud no es JSON válido." }, { status: 400 });
    }

    const validacion = validarActaJuntosPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    // Folio + huella de verificación: viven solo dentro del PDF (nada se guarda).
    const folio = generarFolio("JT");
    const hash = hashCorto(hashContenido(JSON.stringify(validacion.payload), folio));

    // Semáforo de concurrencia: rechaza rápido antes que morir por memoria.
    if (!tomarCupo()) {
      return NextResponse.json(
        { error: MENSAJE_SIN_CUPO },
        { status: 503, headers: { "Retry-After": String(ESPERA_SUGERIDA_SEGUNDOS) } }
      );
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderToBuffer(
        ActaJuntosReport({ data: validacion.payload, folio, hashCorto: hash, logoDataUrl: logoSeiriconDataUrl() })
      );
    } finally {
      soltarCupo(); // sin esto, un error deja el cupo tomado para siempre
    }
    const filename = `acta-documentacion-danos-${folio}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // El cliente lee el folio para citarlo en el derecho de petición.
        "X-Juntos-Folio": folio,
      },
    });
  } catch {
    // Nunca serializar el body ni el error a logs: acá viajan cédula y fotos.
    console.error("POST /api/juntos/acta-pdf: error generando el PDF");
    return NextResponse.json({ error: "No pudimos generar el acta en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
