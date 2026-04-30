import Topbar from "@/components/dashboard/Topbar";
import NuevaConstructoraForm from "./form";

export default function NuevaConstructoraPage() {
  return (
    <>
      <Topbar title="Nueva constructora" subtitle="Registrar una empresa en el sistema" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-100 p-6">
          <NuevaConstructoraForm />
        </div>
      </main>
    </>
  );
}
