import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import { NotificacionesProvider } from "@/components/dashboard/NotificacionesContext";
import { TourProvider } from "@/components/tour/TourProvider";
import TourLauncher from "@/components/tour/TourLauncher";
import { getDashboardTour } from "@/components/tour/tours";
import { getUsuarioActual } from "@/lib/data";
import { tieneConsentimientoVigente } from "@/lib/consent";

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
  if (usuario.rol_ref.nivel_acceso === "CONTRATISTA") redirect("/contratista");
  // Consentimiento obligatorio (una vez) antes de usar la app.
  if (!(await tieneConsentimientoVigente(usuario.id))) redirect("/aceptar-politica");

  const tipoCuenta = usuario?.constructora?.tipo_cuenta ?? "CONSTRUCTORA";
  const tourDashboard = getDashboardTour(tipoCuenta, (usuario?.nombre ?? "").split(" ")[0]);

  return (
    <NotificacionesProvider>
      <TourProvider>
        <div className="flex h-dvh overflow-hidden bg-slate-50">
          <Sidebar
            nivelAcceso={usuario?.rol_ref?.nivel_acceso ?? "ADMIN_GENERAL"}
            tipoCuenta={tipoCuenta}
            userName={usuario?.nombre ?? "Usuario"}
            userRole={usuario?.rol_ref?.nombre ?? ""}
          />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
        <TourLauncher tour={tourDashboard} />
      </TourProvider>
    </NotificacionesProvider>
  );
}
