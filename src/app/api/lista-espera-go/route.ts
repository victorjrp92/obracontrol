import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Lista de espera de Seiricon Go (landing /go-nueva, CTA "Reserva tu cupo").
 * Pública y sin auth (no hay usuario todavía). Validación manual estricta
 * (no hay Zod en el repo), honeypot `sitio_web` (si viene lleno respondemos
 * éxito falso sin escribir), upsert por correo (sin duplicados y sin revelar
 * si el correo ya estaba) y errores genéricos que nunca ecoan el input.
 */

// "constructora" es el B2B: mismo hecho de negocio (alguien levantó la mano
// antes de que hubiera producto que venderle) y por eso comparte tabla.
const AUDIENCIAS = ["propietario", "contratista", "constructora"];
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_BODY = 2048;
// Throttle global sin IPs (amigable con Ley 1581): si en el último minuto ya
// entraron más de N inscripciones, respondemos éxito falso (como el honeypot)
// para no darle señal al atacante ni bloquear un pico legítimo con un error.
const MAX_POR_MINUTO = 20;

export async function POST(req: NextRequest) {
  try {
    // Límite de tamaño del body: primero el header (barato) y luego el real
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const crudo = await req.text();
    if (crudo.length > MAX_BODY) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
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

    const { correo, audiencia, respuesta, origen, sitio_web } = body as Record<string, unknown>;

    // Honeypot: un humano nunca ve este campo. Si viene lleno, éxito falso.
    if (typeof sitio_web === "string" && sitio_web.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    if (typeof correo !== "string") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const correoNorm = correo.trim().toLowerCase();
    if (correoNorm.length === 0 || correoNorm.length > 160 || !CORREO_RE.test(correoNorm)) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof audiencia !== "string" || !AUDIENCIAS.includes(audiencia)) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    if (typeof respuesta !== "string") {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }
    const respuestaNorm = respuesta.trim();
    if (respuestaNorm.length > 200) {
      return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
    }

    let origenNorm: string | null = null;
    if (origen !== undefined && origen !== null) {
      if (typeof origen !== "string" || origen.trim().length > 60) {
        return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
      }
      origenNorm = origen.trim() || null;
    }

    // Throttle global: acota el spam masivo dirigido sin almacenar IPs
    const haceUnMinuto = new Date(Date.now() - 60_000);
    const recientes = await prisma.listaEsperaGo.count({
      where: { created_at: { gte: haceUnMinuto } },
    });
    if (recientes >= MAX_POR_MINUTO) {
      return NextResponse.json({ ok: true });
    }

    // Upsert por correo: sin duplicados y sin revelar si ya estaba en la lista
    await prisma.listaEsperaGo.upsert({
      where: { correo: correoNorm },
      create: {
        correo: correoNorm,
        audiencia,
        respuesta: respuestaNorm,
        origen: origenNorm,
      },
      update: {
        audiencia,
        respuesta: respuestaNorm,
        origen: origenNorm,
      },
    });

    // Nunca devolvemos datos de la tabla
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/lista-espera-go", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
