import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/juntos/rate-limit";
import { normalizarWhatsapp } from "@/lib/juntos/acta-juntos";

/**
 * Contacto del gate de datos de «Juntos» (/go/juntos/documentar). Público y
 * sin auth — patrón de /api/lista-espera-go: validación manual estricta,
 * honeypot `sitio_web` (si viene lleno respondemos éxito falso sin escribir),
 * rate limit en memoria por IP y respuesta genérica que nunca ecoa el input.
 *
 * REGLA DURA (spec-go-juntos.md): esta ruta NO recibe ni acepta cédula ni
 * dirección del inmueble. Esos datos viajan SOLO en el request de generación
 * del PDF (/api/juntos/acta-pdf), se imprimen y se descartan. Aquí se
 * persiste únicamente: nombre, whatsapp, ciudad, audiencia, acepta_contacto
 * y origen. Ningún log serializa el body.
 */

const AUDIENCIAS = ["propietario", "administrador", "contratista"];
const MAX_BODY = 2048;
const MAX_POR_MINUTO_POR_IP = 5;
const WHATSAPP_RE = /^\+?\d{7,15}$/;

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const crudo = await req.text();
    if (crudo.length > MAX_BODY) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    // Rate limit en memoria por IP: al pasarse, éxito falso (como el
    // honeypot) para no darle señal al que abusa ni romper un pico legítimo.
    if (!permitirPeticion(`juntos-contacto:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json({ ok: true });
    }

    let body: unknown;
    try {
      body = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    const { nombre, whatsapp, ciudad, audiencia, acepta_contacto, origen, sitio_web } = body as Record<string, unknown>;

    // Honeypot: un humano nunca ve este campo. Si viene lleno, éxito falso.
    if (typeof sitio_web === "string" && sitio_web.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    if (typeof nombre !== "string") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const nombreNorm = nombre.trim();
    if (nombreNorm.length < 3 || nombreNorm.length > 120) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof whatsapp !== "string") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const whatsappNorm = normalizarWhatsapp(whatsapp.trim());
    if (!WHATSAPP_RE.test(whatsappNorm)) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof ciudad !== "string") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const ciudadNorm = ciudad.trim();
    if (ciudadNorm.length < 2 || ciudadNorm.length > 60) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof audiencia !== "string" || !AUDIENCIAS.includes(audiencia)) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof acepta_contacto !== "boolean") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    let origenNorm: string | null = null;
    if (origen !== undefined && origen !== null) {
      if (typeof origen !== "string" || origen.trim().length > 60) {
        return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
      }
      origenNorm = origen.trim() || null;
    }

    await prisma.contactoJuntos.create({
      data: {
        nombre: nombreNorm,
        whatsapp: whatsappNorm,
        ciudad: ciudadNorm,
        audiencia,
        acepta_contacto,
        origen: origenNorm,
      },
    });

    // Nunca devolvemos datos de la tabla.
    return NextResponse.json({ ok: true });
  } catch {
    // Nunca serializar el body ni el error (puede arrastrar input) a logs.
    console.error("POST /api/juntos/contacto: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
