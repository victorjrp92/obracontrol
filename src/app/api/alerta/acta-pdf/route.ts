import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ActaDanosReport } from "@/lib/pdf/ActaDanosReport";
import { MAX_BODY_BYTES, mensajeActaMuyPesada, validarActaPayload } from "@/lib/alerta/acta";

// Público, sin auth (Seiricon Alerta no tiene tenant). Sin persistencia: recibe
// el payload ya armado por el cliente (fotos en base64 + respuestas) y
// devuelve el PDF, sin guardar nada. Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección C.3.
export const maxDuration = 60;

// POST /api/alerta/acta-pdf — genera y devuelve el Acta de daños en PDF (renderToBuffer, sin stream).
export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeActaMuyPesada() }, { status: 413 });
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
  } catch (error) {
    console.error("POST /api/alerta/acta-pdf", error);
    return NextResponse.json({ error: "No pudimos generar el acta en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
