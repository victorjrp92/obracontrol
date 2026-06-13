"use server";

import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getHomePathForRole } from "@/lib/access";
import { registrarConsentimiento } from "@/lib/consent";

/**
 * Registra el consentimiento del usuario autenticado (con IP + fecha) y lo
 * envía a su pantalla de inicio según el rol.
 */
export async function aceptarPolitica(): Promise<void> {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  await registrarConsentimiento(usuario.id);

  redirect(getHomePathForRole(usuario.rol_ref.nivel_acceso));
}
