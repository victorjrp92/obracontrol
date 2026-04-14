import Sidebar from "@/components/dashboard/Sidebar";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { getUsuarioActual } from "@/lib/data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar
        rol={usuario?.rol ?? "ADMIN"}
        userName={usuario?.nombre ?? "Usuario"}
        userRole={usuario?.rol ?? ""}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
      <InstallPrompt />
    </div>
  );
}
