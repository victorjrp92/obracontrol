import { redirect } from "next/navigation";
import { getUsuarioActual, getProyectosConProgreso } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import { BarChart3, FileCheck, Download, FileText } from "lucide-react";

export default async function ReportesPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  const proyectos = await getProyectosConProgreso(usuario.constructora_id, accessible);

  return (
    <>
      <Topbar title="Reportes" subtitle="Generación y descarga de reportes" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Progreso por proyecto */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-900 text-base">Progreso por proyecto</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Estado actual de avance, tareas aprobadas vs reportadas, y detalle por edificio.
              </p>
            </div>
          </div>

          {proyectos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No hay proyectos activos para generar reporte
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-50">
              {proyectos.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{p.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {p.progreso.porcentajeAprobado}% aprobado · {p.progreso.aprobadas}/
                      {p.progreso.total} tareas
                    </div>
                  </div>
                  <a
                    href={`/api/reportes/progreso/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Descargar PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score de contratistas */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <FileCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-slate-900 text-base">Score de contratistas</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Ranking completo con los 3 ejes de evaluación (cumplimiento 50%, calidad 30%,
                velocidad 20%) y resumen de tareas completadas.
              </p>
              <a
                href="/api/reportes/contratistas"
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

        {/* Próximamente */}
        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-slate-600 text-base">Próximamente</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-2">
                Reporte de extensiones de tiempo y consumo de materiales. Estos reportes se
                activarán en versiones futuras.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
