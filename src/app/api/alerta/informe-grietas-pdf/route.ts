import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { InformeGrietasReport } from "@/lib/pdf/InformeGrietasReport";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { generarFolio, hashContenido, hashCorto } from "@/lib/juntos/folio";
import { MAX_BODY_BYTES } from "@/lib/alerta/acta";
import { mensajeInformeMuyPesado, validarInformeGrietasPayload } from "@/lib/alerta/grietas";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/juntos/rate-limit";

// Público, sin auth (el flujo Juntos no tiene tenant). Sin persistencia:
// recibe el payload ya armado por el cliente (fotos en base64 + veredictos
// ya calculados) y devuelve el PDF, sin guardar nada. Adaptada para Juntos
// (spec-go-juntos.md): rate limit en memoria por IP, folio + hash de
// verificación en el PDF, y ningún log que serialice el body ni el error.
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 6;

// POST /api/alerta/informe-grietas-pdf — genera y devuelve el informe de grietas en PDF (renderToBuffer, sin stream).
export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeInformeMuyPesado() }, { status: 413 });
    }

    if (!permitirPeticion(`alerta-informe:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json(
        { error: "Estamos recibiendo muchas solicitudes desde tu conexión. Espera un minuto e intenta de nuevo." },
        { status: 429 }
      );
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

    const folio = generarFolio("JT");
    const hash = hashCorto(hashContenido(JSON.stringify(validacion.payload), folio));

    const pdfBuffer = await renderToBuffer(
      InformeGrietasReport({ data: validacion.payload, folio, hashCorto: hash, logoDataUrl: logoSeiriconDataUrl() })
    );
    const filename = `informe-de-grietas-${folio}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    // Nunca serializar el body ni el error a logs (fotos en base64).
    console.error("POST /api/alerta/informe-grietas-pdf: error generando el PDF");
    return NextResponse.json({ error: "No pudimos generar el informe en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
