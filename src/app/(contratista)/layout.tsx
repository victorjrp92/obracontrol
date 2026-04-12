import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import SidebarContratista from "@/components/dashboard/SidebarContratista";

export default async function ContratistaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    redirect("/login");
  }

  if (usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <SidebarContratista
        userName={usuario.nombre}
        userRole={usuario.rol_ref.nombre}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
