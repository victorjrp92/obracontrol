import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ActaDanosReport } from "@/lib/pdf/ActaDanosReport";
import { MAX_BODY_BYTES, mensajeActaMuyPesada, validarActaPayload } from "@/lib/alerta/acta";
import { sendEmail } from "@/lib/email";
import { baseEmailHtml } from "@/lib/email-templates/base";
import { escapeHtml } from "@/lib/email-templates/escape";

// Público, sin auth. Mismo payload que acta-pdf + `email` (+ `honeypot`
// oculto, ver spec addendum R3: no hay rate limiting en el repo, esta es la
// mitigación mínima). Envío efímero: NO crea fila en DB, no hay
// `MensajeContacto` de por medio. Ver spec sección C.4.
export const maxDuration = 60;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/alerta/acta-email — genera el PDF (igual que acta-pdf) y lo envía por Resend como adjunto.
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

    const b = body as Record<string, unknown> | null;

    // Honeypot: campo oculto que un humano nunca llena. Si viene con contenido,
    // fingimos éxito para no delatarle a un bot que fue detectado.
    if (typeof b?.honeypot === "string" && b.honeypot.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    const email = typeof b?.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Correo electrónico no válido." }, { status: 400 });
    }

    const validacion = validarActaPayload(body);
    if (!validacion.ok) {
      return NextResponse.json({ error: validacion.error }, { status: 400 });
    }

    const pdfBuffer = await renderToBuffer(ActaDanosReport({ data: validacion.payload }));
    const filename = `acta-de-danos-${new Date().toISOString().split("T")[0]}.pdf`;

    const html = baseEmailHtml({
      title: "Tu acta de daños",
      preheader: "Copia de tu acta de daños generada en Seiricon Alerta",
      body: `
        <p>Adjunto va el acta de daños que documentaste en Seiricon Alerta para
        <strong>${escapeHtml(validacion.payload.inmueble.descripcion)}</strong>.</p>
        <p>Recuerda: esta herramienta no reemplaza una evaluación de un ingeniero estructural.
        Comparte este acta como punto de partida con quien haga esa evaluación.</p>
      `,
    });

    await sendEmail({
      to: email,
      subject: "Tu acta de daños — Seiricon Alerta",
      html,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/alerta/acta-email", error);
    return NextResponse.json({ error: "No pudimos enviar el correo. Intenta de nuevo." }, { status: 500 });
  }
}
