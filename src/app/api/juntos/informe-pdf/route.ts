import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { InformeGrietasReport } from "@/lib/pdf/InformeGrietasReport";
import { logoSeiriconDataUrl } from "@/lib/pdf/logo";
import { generarFolio, hashContenido, hashCorto } from "@/lib/juntos/folio";
import {
  MAX_BODY_BYTES,
  mensajeInformeMuyPesado,
  validarInformeJuntosPayload,
} from "@/lib/juntos/informe-juntos";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";
import { registrarDocumento } from "@/lib/juntos/registro-documento";
import { ESPERA_SUGERIDA_SEGUNDOS, MENSAJE_SIN_CUPO, soltarCupo, tomarCupo } from "@/lib/juntos/compuerta";
import { juntosPausado, MENSAJE_PAUSA_API } from "@/lib/juntos/pausa";

/**
 * POST /api/juntos/informe-pdf — genera y devuelve el Informe de grietas de
 * «Juntos», CON el bloque de identidad del gate de datos. Público, sin auth,
 * SIN PERSISTENCIA de ningún tipo. Mismas garantías que /api/juntos/acta-pdf.
 *
 * Nació como ruta aparte de /api/alerta/informe-grietas-pdf, que servía al
 * flujo de Fase 2 sin pedir identidad. Aquella ruta ya no existe: se borró por
 * huérfana junto con su wizard. Esta es hoy la única que genera el informe, y
 * la identidad es obligatoria porque todo PDF del flujo Juntos pasa por el gate.
 *
 * REGLA DURA (spec-go-juntos.md): la cédula y la dirección del inmueble
 * ENTRAN en este request, se IMPRIMEN en el PDF y se DESCARTAN al responder.
 * No se escriben en base de datos, ni en logs, ni en ningún otro lado — por
 * eso ningún `catch` de esta ruta serializa el body ni el error.
 */
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 6;

export async function POST(req: NextRequest) {
  // Interruptor de emergencia: se corta antes de leer el cuerpo, así una
  // avalancha no cuesta ni el ancho de banda de las fotos.
  if (juntosPausado()) {
    return NextResponse.json({ error: MENSAJE_PAUSA_API }, { status: 503 });
  }

  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: mensajeInformeMuyPesado() }, { status: 413 });
    }

    if (!permitirPeticion(`juntos-informe:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
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

    const validacion = validarInformeJuntosPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    // Folio + huella: se imprimen en el PDF y se registran para poder verificarlos.
    const folio = generarFolio("JT");
    const hashCompleto = hashContenido(JSON.stringify(validacion.payload), folio);
    const hash = hashCorto(hashCompleto);

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
        InformeGrietasReport({ data: validacion.payload, folio, hashCorto: hash, logoDataUrl: logoSeiriconDataUrl() })
      );
    } finally {
      soltarCupo(); // sin esto, un error deja el cupo tomado para siempre
    }
    // Registro de verificación. Aquí sí se guarda el NIVEL, porque el agregado
    // «cuántas casas en rojo por ciudad» es exactamente lo que una alcaldía
    // necesita para priorizar el censo del RUD — y no identifica a nadie.
    // El nivel del inmueble es el PEOR de sus grietas, nunca el promedio
    // (misma regla que `evaluarInmueble` en reglas.ts).
    const RANGO: Record<string, number> = { verde: 0, amarillo: 1, rojo: 2 };
    const nivelPeor = validacion.payload.grietas.reduce<string | null>((peor, g) => {
      const n = g.veredicto.nivel;
      if (!peor) return n;
      return RANGO[n] > RANGO[peor] ? n : peor;
    }, null);

    await registrarDocumento({
      folio,
      hash: hashCompleto,
      tipo: "INFORME",
      ciudad: validacion.payload.identidad.ciudad,
      nivel: nivelPeor,
      piezas: validacion.payload.grietas.length,
    });

    const filename = `informe-de-grietas-${folio}.pdf`;

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
    // Nunca serializar el body ni el error a logs: acá viajan cédula y fotos.
    console.error("POST /api/juntos/informe-pdf: error generando el PDF");
    return NextResponse.json({ error: "No pudimos generar el informe en PDF. Intenta de nuevo." }, { status: 500 });
  }
}
