import { redirect } from "next/navigation";
import { getHomePathForRole, isFieldStaff } from "@/lib/access";
import { tieneConsentimientoVigente } from "@/lib/consent";
import { getUsuarioActual } from "@/lib/data";
import { NotificacionesProvider } from "@/components/dashboard/NotificacionesContext";
import SidebarCampo from "./SidebarCampo";

// Cada request lee la sesión del usuario actual: sin esto Next podría cachear
// el layout y enseñarle a uno las obras del anterior.
export const dynamic = "force-dynamic";

/**
 * Zona del PERSONAL DE CAMPO (/campo). Auxiliares y residentes de obra: ven
 * las obras que un administrador les asignó, sus fases en orden, las tareas
 * por espacio y los planos. No administran nada.
 *
 * ══ LAS TRES PUERTAS, EN ESTE ORDEN ════════════════════════════════════════
 *
 * 1. Sesión. Sin usuario, al login.
 * 2. Nivel. A quien no sea PERSONAL_CAMPO se le manda a SU pantalla de inicio
 *    (`getHomePathForRole`) y no a `/dashboard` a secas: un CONTRATISTA que
 *    cayera aquí rebotaría a /dashboard y de ahí otra vez a /contratista, dos
 *    saltos para llegar al mismo sitio.
 * 3. Consentimiento (Ley 1581 de 2012). Este grupo de rutas está FUERA de
 *    `(dashboard)`, donde vive el gate original, así que hay que repetirlo
 *    aquí: sin esta línea el rol nuevo sería el único de la aplicación que
 *    usa el producto sin haber autorizado el tratamiento de sus datos —
 *    justo el rol cuya cuenta crea la empresa, no él.
 */
export default async function CampoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();

  if (!usuario) redirect("/login");

  if (!isFieldStaff(usuario.rol_ref.nivel_acceso)) {
    redirect(getHomePathForRole(usuario.rol_ref.nivel_acceso));
  }

  if (!(await tieneConsentimientoVigente(usuario.id))) redirect("/aceptar-politica");

  return (
    <NotificacionesProvider>
      <div className="flex h-dvh overflow-hidden bg-slate-50">
        <SidebarCampo userName={usuario.nombre} userRole={usuario.rol_ref.nombre} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
      </div>
    </NotificacionesProvider>
  );
}
