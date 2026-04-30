import Topbar from "@/components/dashboard/Topbar";
import { BarChart3 } from "lucide-react";

export default function ReportesGlobalesPage() {
  return (
    <>
      <Topbar title="Reportes globales" subtitle="Métricas cross-tenant del sistema" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-700 mb-1">Reportes globales</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Próximamente: KPIs agregados de todas las constructoras, comparativas, y exportes de
            uso por plan.
          </p>
        </div>
      </main>
    </>
  );
}
