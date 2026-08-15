import { NextRequest, NextResponse } from "next/server";
import { MAX_BODY_OBSERVACION_BYTES, mensajeObservacionMuyPesada, validarObservarGrietaPayload } from "@/lib/alerta/grietas";
import { observarGrieta } from "@/lib/alerta/observar-grieta";
import { claveDesdeHeaders, permitirPeticion } from "@/lib/rate-limit";

// Público, sin auth (el flujo Juntos no tiene tenant). Sin persistencia.
// Siempre responde 200 con `{ok:true,...}` o `{ok:false, motivo}` — nunca
// rompe el flujo del cliente (spec sección 3): las ÚNICAS excepciones son el
// payload sobredimensionado (413) y el rate limit (429 implícito como
// {ok:false}, el cliente cae a modo manual). Adaptada para Juntos
// (spec-go-juntos.md): rate limit en memoria por IP, sin logs de datos.
export const maxDuration = 60;

const MAX_POR_MINUTO_POR_IP = 10;

/** Chequeo best-effort de Origin/Referer propio. */
function origenValido(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return true;
  const valor = req.headers.get("origin") || req.headers.get("referer");
  if (!valor) return true; // best-effort: no todos los clientes mandan estos headers
  try {
    return new URL(valor).host === host;
  } catch {
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_OBSERVACION_BYTES) {
      return NextResponse.json({ error: mensajeObservacionMuyPesada() }, { status: 413 });
    }

    // Rate limit en memoria por IP: el cliente interpreta {ok:false} como
    // "sin lectura automática" y cae a modo manual — el flujo nunca se rompe.
    if (!permitirPeticion(`alerta-observar:${claveDesdeHeaders(req.headers)}`, MAX_POR_MINUTO_POR_IP)) {
      return NextResponse.json({ ok: false, motivo: "error" as const });
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_OBSERVACION_BYTES) {
      return NextResponse.json({ error: mensajeObservacionMuyPesada() }, { status: 413 });
    }

    if (!origenValido(req)) {
      return NextResponse.json({ ok: false, motivo: "error" as const });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, motivo: "error" as const });
    }

    const validacion = validarObservarGrietaPayload(body);
    if (!validacion.ok) {
      // Nunca rompe el flujo del cliente: si el payload no es válido, el
      // cliente igual puede caer a modo manual con motivo "error".
      return NextResponse.json({ ok: false, motivo: "error" as const });
    }

    const resultado = await observarGrieta(validacion.payload);
    return NextResponse.json(resultado);
  } catch {
    // Nunca serializar el body ni el error a logs (fotos en base64).
    console.error("POST /api/alerta/observar-grieta: error interno");
    return NextResponse.json({ ok: false, motivo: "error" as const });
  }
}
