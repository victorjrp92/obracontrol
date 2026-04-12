import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import SidebarDirectivo from "@/components/dashboard/SidebarDirectivo";

export default async function DirectivoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  if (!usuario) redirect("/login");
  if (usuario.rol_ref?.nivel_acceso !== "DIRECTIVO") redirect("/dashboard");

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <SidebarDirectivo userName={usuario.nombre} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
