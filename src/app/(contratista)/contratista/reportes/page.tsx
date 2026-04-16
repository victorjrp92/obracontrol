import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import { FileText, Download, History } from "lucide-react";

export default async function ContratistaReportesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  return (
    <>
      <Topbar title="Reportes" subtitle="Descarga tus reportes en PDF" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Reporte de tareas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900 text-base">Reporte de tareas</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Resumen de todas tus tareas asignadas: estado actual, progreso aprobado, días
                restantes y ubicación por proyecto.
              </p>
              <a
                href="/api/reportes/contratista/tareas"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </a>
            </div>
          </div>
        </div>

        {/* Historial de aprobaciones */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <History className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900 text-base">Historial de aprobaciones</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Registro cronológico de todas las decisiones de aprobación y rechazo sobre tus
                tareas, con el aprobador y justificación de cada caso.
              </p>
              <a
                href="/api/reportes/contratista/historial"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
