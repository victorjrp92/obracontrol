import { prisma } from "@/lib/prisma";
import { extenderVigencia } from "@/lib/suscripcion";
import { traducirEstado, type TransaccionWompi } from "./wompi";
import type { EstadoPagoSuscripcion } from "@/generated/prisma";

/**
 * Qué hacer con un pago cuando ya sabemos, de boca de Wompi, cómo terminó.
 *
 * Vive aquí y no dentro del webhook porque hay DOS caminos que llegan a esta
 * misma decisión y no pueden divergir:
 *
 *   1. El webhook, cuando Wompi avisa.
 *   2. La conciliación, cuando el webhook NO avisó — se perdió, la ruta estaba
 *      caída, o Wompi agotó sus reintentos. Sin ella, ese pago se queda
 *      PENDIENTE para siempre. Y «PENDIENTE para siempre» puede significar
 *      dinero cobrado sin acceso concedido, que es la peor forma de fallar:
 *      el cliente pagó y el producto le dice que no.
 *
 * Duplicar estas reglas en los dos sitios es exactamente lo que en este repo ya
 * salió mal con las listas de perfiles. Una sola función, dos llamadores.
 */

export type ResultadoConciliacion =
  | { accion: "ya_resuelto"; estado: EstadoPagoSuscripcion }
  | { accion: "sigue_pendiente" }
  | { accion: "monto_no_coincide"; esperado: number; recibido: number }
  | { accion: "registrado"; estado: EstadoPagoSuscripcion }
  | { accion: "acreditado"; venceEl: Date };

export interface PagoAConciliar {
  id: string;
  estado: EstadoPagoSuscripcion;
  monto_centavos: number;
  periodo_meses: number;
  plan: import("@/generated/prisma").PlanTipo;
  constructora_id: string;
  constructora: { suscripcion_vence_el: Date | null };
}

/**
 * Aplica el resultado de una transacción a su pago. Idempotente por diseño: si
 * el pago ya no está PENDIENTE no toca nada, así que un reintento de Wompi o una
 * conciliación que se cruce con el webhook no extienden la vigencia dos veces.
 */
export async function aplicarResultado(
  pago: PagoAConciliar,
  confirmada: TransaccionWompi,
  ahora: Date = new Date(),
): Promise<ResultadoConciliacion> {
  if (pago.estado !== "PENDIENTE") {
    return { accion: "ya_resuelto", estado: pago.estado };
  }

  const nuevoEstado = traducirEstado(confirmada.status);
  if (nuevoEstado === "PENDIENTE") {
    return { accion: "sigue_pendiente" };
  }

  const datosComunes = {
    wompi_transaccion_id: confirmada.id,
    metodo: confirmada.payment_method_type ?? null,
  };

  // El monto cobrado tiene que ser el que registramos. Si no cuadra no se
  // acredita nada y se marca ERROR: es una discrepancia de dinero y tiene que
  // quedar visible en el historial, no resolverse en silencio en ninguna de las
  // dos direcciones.
  if (nuevoEstado === "APROBADO" && confirmada.amount_in_cents !== pago.monto_centavos) {
    await prisma.pagoSuscripcion.update({
      where: { id: pago.id },
      data: { estado: "ERROR", ...datosComunes },
    });
    return {
      accion: "monto_no_coincide",
      esperado: pago.monto_centavos,
      recibido: confirmada.amount_in_cents,
    };
  }

  if (nuevoEstado !== "APROBADO") {
    await prisma.pagoSuscripcion.update({
      where: { id: pago.id },
      data: { estado: nuevoEstado, ...datosComunes },
    });
    return { accion: "registrado", estado: nuevoEstado };
  }

  const desde = pago.constructora.suscripcion_vence_el;
  const nuevoVence = extenderVigencia(desde, pago.periodo_meses, ahora);

  // En una transacción: o se registra el pago Y se extiende la vigencia, o no
  // pasa nada. Nunca cobrar sin acreditar.
  await prisma.$transaction([
    prisma.pagoSuscripcion.update({
      where: { id: pago.id },
      data: {
        estado: "APROBADO",
        ...datosComunes,
        cubre_desde: desde && desde > ahora ? desde : ahora,
        cubre_hasta: nuevoVence,
      },
    }),
    prisma.constructora.update({
      where: { id: pago.constructora_id },
      data: {
        plan_suscripcion: pago.plan,
        estado_suscripcion: "ACTIVA",
        suscripcion_vence_el: nuevoVence,
      },
    }),
  ]);

  return { accion: "acreditado", venceEl: nuevoVence };
}

/** Lo que hay que traer de la base para poder conciliar un pago. */
export const SELECCION_PAGO = {
  id: true,
  estado: true,
  monto_centavos: true,
  periodo_meses: true,
  plan: true,
  constructora_id: true,
  referencia: true,
  created_at: true,
  wompi_transaccion_id: true,
  constructora: { select: { suscripcion_vence_el: true } },
} as const;
