import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aplicarResultado, SELECCION_PAGO } from "@/lib/pagos/conciliacion";
import {
  consultarTransaccion,
  eventoEsAutentico,
  type EventoWompi,
} from "@/lib/pagos/wompi";

/**
 * POST /api/pagos/wompi/webhook — Wompi avisa que una transacción cambió de estado.
 *
 * Es la única ruta del producto que otorga acceso pagado, así que asume que
 * quien la llama es hostil hasta demostrar lo contrario. Tres candados, en orden:
 *
 *  1. FIRMA. Se valida el checksum SHA-256 del evento contra WOMPI_EVENTS_SECRET.
 *     Sin esto, cualquiera puede declarar aprobado un pago que nunca ocurrió.
 *  2. CONFIRMACIÓN CONTRA LA API. Aunque la firma pase, el estado se vuelve a
 *     consultar a Wompi con la llave privada. La fuente de verdad es Wompi, no
 *     el cuerpo que llegó por la red.
 *  3. IDEMPOTENCIA. Wompi reintenta los webhooks. `referencia` es única y el
 *     pago solo se acredita si estaba PENDIENTE: un reintento del mismo evento
 *     no extiende la vigencia dos veces.
 *
 * También valida el MONTO: si lo cobrado no coincide con lo que se registró al
 * crear el cobro, no se acredita. Eso cierra el hueco de que alguien manipule el
 * monto en el checkout y pague $1.000 por el plan Empresa.
 *
 * Siempre responde 200 salvo error interno: un 4xx haría que Wompi reintente en
 * bucle un evento que nunca vamos a aceptar.
 */

export const maxDuration = 30;

/** Wompi manda cuerpos pequeños; nada legítimo se acerca a este tope. */
const MAX_BODY = 32 * 1024;

export async function POST(req: NextRequest) {
  try {
    const crudo = await req.text();
    if (crudo.length > MAX_BODY) {
      return NextResponse.json({ ok: true, ignorado: "cuerpo excesivo" });
    }

    let evento: EventoWompi;
    try {
      evento = JSON.parse(crudo);
    } catch {
      return NextResponse.json({ ok: true, ignorado: "json inválido" });
    }

    // ── Candado 1: firma ──────────────────────────────────────────────────
    if (!eventoEsAutentico(evento)) {
      // No se registra el cuerpo: viene de una fuente no confiable.
      console.error("webhook wompi: firma inválida");
      return NextResponse.json({ ok: true, ignorado: "firma inválida" });
    }

    if (evento.event !== "transaction.updated") {
      return NextResponse.json({ ok: true, ignorado: evento.event });
    }

    const transaccion = (evento.data as { transaction?: Record<string, unknown> })?.transaction;
    const idTransaccion = typeof transaccion?.id === "string" ? transaccion.id : null;
    const referencia = typeof transaccion?.reference === "string" ? transaccion.reference : null;
    if (!idTransaccion || !referencia) {
      return NextResponse.json({ ok: true, ignorado: "evento sin id o referencia" });
    }

    // ── Candado 2: confirmar contra la API de Wompi ───────────────────────
    const confirmada = await consultarTransaccion(idTransaccion);
    if (!confirmada) {
      // No se pudo verificar. Se responde 200 para que Wompi reintente más
      // tarde en vez de dar por bueno algo que no confirmamos.
      console.error("webhook wompi: no se pudo confirmar la transacción contra la API");
      return NextResponse.json({ ok: true, pendiente: "sin confirmar" });
    }
    if (confirmada.reference !== referencia) {
      console.error("webhook wompi: la referencia del evento no coincide con la de la API");
      return NextResponse.json({ ok: true, ignorado: "referencia inconsistente" });
    }

    const pago = await prisma.pagoSuscripcion.findUnique({
      where: { referencia },
      select: SELECCION_PAGO,
    });
    if (!pago) {
      return NextResponse.json({ ok: true, ignorado: "referencia desconocida" });
    }

    // ── Candado 3: idempotencia, y el resto de las reglas ─────────────────
    // La decisión vive en `@/lib/pagos/conciliacion` porque el conciliador de
    // pagos huérfanos tiene que aplicar EXACTAMENTE las mismas: un pago que se
    // resuelve por webhook y otro que se resuelve por conciliación no pueden
    // acabar distintos.
    const resultado = await aplicarResultado(pago, confirmada);

    if (resultado.accion === "monto_no_coincide") {
      console.error("webhook wompi: el monto cobrado no coincide con el registrado");
      return NextResponse.json({ ok: true, ignorado: "monto inconsistente" });
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Nunca serializar el cuerpo ni el error: acá viajan datos de pago.
    console.error("POST /api/pagos/wompi/webhook: error interno");
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
