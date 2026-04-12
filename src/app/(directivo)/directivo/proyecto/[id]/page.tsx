import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUsuarioActual } from "@/lib/data";
import { getProyectoDetallado } from "@/lib/data-directivo";
import Topbar from "@/components/dashboard/Topbar";
import ProgressBar from "@/components/dashboard/ProgressBar";
import { ArrowLeft, Building2, Home } from "lucide-react";

const semaforoMap: Record<string, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

const taskStatusColors = [
  { key: "aprobadas", label: "Aprobadas", color: "bg-green-500" },
  { key: "reportadas", label: "Reportadas", color: "bg-blue-500" },
  { key: "pendientes", label: "Pendientes", color: "bg-slate-300" },
  { key: "noAprobadas", label: "No aprobadas", color: "bg-red-500" },
] as const;

export default async function ProyectoDirectivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const proyecto = await getProyectoDetallado(id, usuario.constructora_id);
  if (!proyecto) notFound();

  const fechaFin = proyecto.fechaFin
    ? new Date(proyecto.fechaFin).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Sin fecha estimada";

  const total = proyecto.taskDistribution.total;

  return (
    <>
      <Topbar title={proyecto.nombre} subtitle="Vista ejecutiva · Detalle de proyecto" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Back link */}
        <Link
          href="/directivo"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a vista ejecutiva
        </Link>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Edificios</p>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {proyecto.totalEdificios}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Unidades</p>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {proyecto.totalUnidades}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Progreso aprobado</p>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {proyecto.progresoGlobal.porcentajeAprobado}%
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs text-slate-500 mb-1">Fecha fin estimada</p>
            <div className="text-sm font-bold text-slate-800 mt-1">{fechaFin}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Buildings table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 overflow-x-auto">
            <h2 className="font-bold text-slate-800 mb-4">Progreso por edificio</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left pb-2 pr-3 font-medium">Edificio</th>
                  <th className="text-right pb-2 px-3 font-medium">Unidades</th>
                  <th className="text-right pb-2 px-3 font-medium">Tareas</th>
                  <th className="text-right pb-2 px-3 font-medium">Reportado</th>
                  <th className="text-right pb-2 pl-3 font-medium">Aprobado</th>
                </tr>
              </thead>
              <tbody>
                {proyecto.edificios.map((e) => {
                  const dotColor = semaforoMap[e.semaforo] ?? "bg-green-500";
                  return (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}
                          />
                          <span className="font-medium text-slate-700">{e.nombre}</span>
                          {e.esZonaComun && (
                            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                              Zona común
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                        {e.totalUnidades}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                        {e.tareasAprobadas}/{e.tareasTotales}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-blue-500 font-medium">
                        {e.reportadoPct}%
                      </td>
                      <td className="py-3 pl-3 text-right tabular-nums text-slate-800 font-semibold">
                        {e.aprobadoPct}%
                      </td>
                    </tr>
                  );
                })}
                {proyecto.edificios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                      Sin edificios registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Task status distribution */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <h2 className="font-bold text-slate-800 mb-4">Estado de tareas</h2>
            <div className="flex flex-col gap-3 mb-5">
              {taskStatusColors.map((item) => {
                const value = proyecto.taskDistribution[item.key];
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return (
                  <div key={item.key} className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`}
                    />
                    <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                    <span className="text-sm font-semibold text-slate-800 tabular-nums">
                      {value}
                    </span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-slate-400 text-center">
              {total} tareas en total
            </div>

            {/* Overall progress bar */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <ProgressBar
                label="Progreso global"
                reported={proyecto.progresoGlobal.porcentajeReportado}
                approved={proyecto.progresoGlobal.porcentajeAprobado}
              />
            </div>
          </div>
        </div>

        {/* Buildings progress bars */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
          <h2 className="font-bold text-slate-800 mb-5">Avance visual por edificio</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {proyecto.edificios.map((e) => (
              <div key={e.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  {e.esZonaComun ? (
                    <Home className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {e.nombre}
                  </span>
                  {e.esZonaComun && (
                    <span className="text-[9px] bg-violet-100 text-violet-700 px-1 py-0.5 rounded font-medium">
                      ZC
                    </span>
                  )}
                </div>
                <ProgressBar
                  label=""
                  reported={e.reportadoPct}
                  approved={e.aprobadoPct}
                  semaforoColor={e.semaforo}
                />
              </div>
            ))}
            {proyecto.edificios.length === 0 && (
              <p className="text-sm text-slate-400 col-span-full text-center py-4">
                Sin edificios registrados
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
