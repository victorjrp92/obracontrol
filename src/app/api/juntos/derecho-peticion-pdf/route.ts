import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { DerechoPeticionReport } from "@/lib/pdf/DerechoPeticionReport";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { generarFolio, hashContenido, hashCorto } from "@/lib/juntos/folio";
import {
  MAX_BODY_PETICION_BYTES,
  mensajePeticionMuyPesada,
  validarDerechoPeticionPayload,
} from "@/lib/juntos/derecho-peticion";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";

/**
 * POST /api/juntos/derecho-peticion-pdf — genera y devuelve el derecho de
 * petición prellenado con los datos y daños declarados. MISMAS GARANTÍAS que
 * /api/juntos/acta-pdf (spec-go-juntos.md): público, sin auth, sin
 * persistencia; la cédula y la dirección entran en el request, se imprimen y
 * se descartan; ningún log serializa el body ni el error.
 */
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 6;

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_PETICION_BYTES) {
      return NextResponse.json({ error: mensajePeticionMuyPesada() }, { status: 413 });
    }

    if (!permitirPeticion(`juntos-peticion:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json(
        { error: "Estamos recibiendo muchas solicitudes desde tu conexión. Espera un minuto e intenta de nuevo." },
        { status: 429 }
      );
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_PETICION_BYTES) {
      return NextResponse.json({ error: mensajePeticionMuyPesada() }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Cuerpo de la solicitud no es JSON válido." }, { status: 400 });
    }

    const validacion = validarDerechoPeticionPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const folio = generarFolio("DP");
    const hash = hashCorto(hashContenido(JSON.stringify(validacion.payload), folio));

    const pdfBuffer = await renderToBuffer(
      DerechoPeticionReport({ data: validacion.payload, folio, hashCorto: hash, logoDataUrl: logoSeiriconDataUrl() })
    );
    const filename = `derecho-de-peticion-${folio}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // El cliente nombra el archivo con el mismo folio impreso en el PDF.
        "X-Juntos-Folio": folio,
      },
    });
  } catch {
    // Nunca serializar el body ni el error a logs: acá viajan cédula y dirección.
    console.error("POST /api/juntos/derecho-peticion-pdf: error generando el PDF");
    return NextResponse.json({ error: "No pudimos generar el documento. Intenta de nuevo." }, { status: 500 });
  }
}
