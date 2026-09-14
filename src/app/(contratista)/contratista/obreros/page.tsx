import Topbar from "@/components/dashboard/Topbar";
import ObreroManager from "@/components/dashboard/ObreroManager";

export default function ObrerosPage() {
  return (
    <>
      {/* Maestros, no «personal de campo»: ese nombre es del rol PERSONAL_CAMPO. */}
      <Topbar title="Mis maestros" subtitle="Gestiona el acceso de tus maestros" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ObreroManager />
      </main>
    </>
  );
}
