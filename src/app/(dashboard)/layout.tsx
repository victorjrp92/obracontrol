import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Sidebar from "@/components/dashboard/Sidebar";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { getUsuarioActual } from "@/lib/data";

// Forzar render dinámico — cada request lee cookies del usuario actual.
// Sin esto, Next podría cachear el layout y mostrar datos del usuario anterior.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) redirect("/login");
  if (usuario.rol_ref.nivel_acceso === "SUPER_ADMIN") redirect("/super-admin");

  // CONTRATISTA solo puede acceder a /dashboard/mis-tareas dentro del dashboard.
  if (usuario.rol_ref.nivel_acceso === "CONTRATISTA") {
    const h = await headers();
    const pathname = h.get("x-pathname") ?? "";
    if (!pathname.startsWith("/dashboard/mis-tareas")) {
      redirect("/contratista");
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        nivelAcceso={usuario?.rol_ref?.nivel_acceso ?? "ADMIN_GENERAL"}
        userName={usuario?.nombre ?? "Usuario"}
        userRole={usuario?.rol_ref?.nombre ?? ""}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
      <InstallPrompt />
    </div>
  );
}
