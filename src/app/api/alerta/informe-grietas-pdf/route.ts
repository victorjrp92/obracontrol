import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { InformeGrietasReport } from "@/lib/pdf/InformeGrietasReport";
import { MAX_BODY_BYTES } from "@/lib/alerta/acta";
import { mensajeInformeMuyPesado, validarInformeGrietasPayload } from "@/lib/alerta/grietas";

// Público, sin auth (Seiricon Alerta no tiene tenant). Sin persistencia:
// recibe el payload ya armado por el cliente (fotos en base64 + veredictos
// ya calculados) y devuelve el PDF, sin guardar nada. Calcado de
// acta-pdf/route.ts (Fase 1). Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md.
export const maxDuration = 60;

// POST /api/alerta/informe-grietas-pdf — genera y devuelve el informe de grietas en PDF (renderToBuffer, sin stream).
export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeInformeMuyPesado() }, { status: 413 });
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeInformeMuyPesado() }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud no es JSON válido." }, { status: 400 });
    }

    const validacion = validarInformeGrietasPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const pdfBuffer = await renderToBuffer(InformeGrietasReport({ data: validacion.payload }));
    const filename = `informe-de-grietas-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("POST /api/alerta/informe-grietas-pdf", error);
    return NextResponse.json({ error: "No pudimos generar el informe en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
