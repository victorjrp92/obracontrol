import { NextRequest, NextResponse } from "next/server";
import { MAX_BODY_OBSERVACION_BYTES, mensajeObservacionMuyPesada, validarObservarGrietaPayload } from "@/lib/alerta/grietas";
import { observarGrieta } from "@/lib/alerta/observar-grieta";

// Público, sin auth (Seiricon Alerta no tiene tenant). Sin persistencia.
// Siempre responde 200 con `{ok:true,...}` o `{ok:false, motivo}` — nunca
// rompe el flujo del cliente (spec sección 3): la ÚNICA excepción es el
// payload sobredimensionado (413). Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md.
export const maxDuration = 60;

/** Chequeo best-effort de Origin/Referer propio (spec sección 3, R3 de Fase 1: sin rate limiting real). */
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
  } catch (error) {
    console.error("POST /api/alerta/observar-grieta", error);
    return NextResponse.json({ ok: false, motivo: "error" as const });
  }
}
