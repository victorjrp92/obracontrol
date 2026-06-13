import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * ─── Consentimiento de tratamiento de datos (Ley 1581 de 2012 / Habeas Data) ─
 *
 * Registramos de forma auditable la autorización del titular: versión del
 * documento aceptado, IP, user-agent y fecha. Es obligatorio una vez por usuario
 * para la versión vigente; subir `POLITICA_VERSION` obliga a re-aceptar a todos.
 */

// Subir esta fecha cuando cambie la política → todos re-aceptan en su próximo acceso.
export const POLITICA_VERSION = "2026-06-1";

/** Documento(s) que cubre el consentimiento registrado. */
export const DOCUMENTO_CONSENTIMIENTO = "privacidad+terminos";

/** Extrae IP y user-agent del request actual (server-only). */
export async function getClientInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  // x-forwarded-for puede traer una lista "client, proxy1, proxy2"; el primero es el cliente.
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0]?.trim() : null) ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

/** ¿El usuario ya aceptó la versión vigente de la política? */
export async function tieneConsentimientoVigente(usuarioId: string): Promise<boolean> {
  const existente = await prisma.consentimientoDatos.findFirst({
    where: { usuario_id: usuarioId, version: POLITICA_VERSION },
    select: { id: true },
  });
  return existente !== null;
}

/**
 * Registra el consentimiento del usuario para la versión vigente, capturando
 * IP + user-agent del request. Idempotente: no duplica si ya existe.
 */
export async function registrarConsentimiento(usuarioId: string): Promise<void> {
  const yaTiene = await tieneConsentimientoVigente(usuarioId);
  if (yaTiene) return;

  const { ip, userAgent } = await getClientInfo();
  await prisma.consentimientoDatos.create({
    data: {
      usuario_id: usuarioId,
      version: POLITICA_VERSION,
      documento: DOCUMENTO_CONSENTIMIENTO,
      ip,
      user_agent: userAgent,
    },
  });
}
