import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import SidebarSuperAdmin from "@/components/dashboard/SidebarSuperAdmin";
import { NotificacionesProvider } from "@/components/dashboard/NotificacionesContext";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) redirect("/login");
  if (usuario.rol_ref?.nivel_acceso !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <NotificacionesProvider>
      <div className="flex h-dvh overflow-hidden bg-slate-50">
        <SidebarSuperAdmin userName={usuario.nombre} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
      </div>
    </NotificacionesProvider>
  );
}
