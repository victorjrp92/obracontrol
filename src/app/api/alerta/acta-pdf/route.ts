import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ActaDanosReport } from "@/lib/pdf/ActaDanosReport";
import { MAX_BODY_BYTES, mensajeActaMuyPesada, validarActaPayload } from "@/lib/alerta/acta";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/juntos/rate-limit";

// Público, sin auth (Seiricon Alerta no tiene tenant). Sin persistencia: recibe
// el payload ya armado por el cliente (fotos en base64 + respuestas) y
// devuelve el PDF, sin guardar nada. Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección C.3.
// NOTA Juntos (spec-go-juntos.md): el flujo /go/juntos NO monta esta ruta —
// usa /api/juntos/acta-pdf (acta con identidad). Se conserva con rate limit
// y sin logs de datos por ser pública.
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 6;

// POST /api/alerta/acta-pdf — genera y devuelve el Acta de daños en PDF (renderToBuffer, sin stream).
export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeActaMuyPesada() }, { status: 413 });
    }

    if (!permitirPeticion(`alerta-acta:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json(
        { error: "Estamos recibiendo muchas solicitudes desde tu conexión. Espera un minuto e intenta de nuevo." },
        { status: 429 }
      );
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeActaMuyPesada() }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud no es JSON válido." }, { status: 400 });
    }

    const validacion = validarActaPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const pdfBuffer = await renderToBuffer(ActaDanosReport({ data: validacion.payload }));
    const filename = `acta-de-danos-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    // Nunca serializar el body ni el error a logs (fotos en base64).
    console.error("POST /api/alerta/acta-pdf: error generando el PDF");
    return NextResponse.json({ error: "No pudimos generar el acta en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
