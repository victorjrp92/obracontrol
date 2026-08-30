import Topbar from "@/components/dashboard/Topbar";
import ObreroManager from "@/components/dashboard/ObreroManager";

export default function ObrerosPage() {
  return (
    <>
      <Topbar title="Mi personal de campo" subtitle="Gestiona el acceso de tus obreros" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ObreroManager />
      </main>
    </>
  );
}
