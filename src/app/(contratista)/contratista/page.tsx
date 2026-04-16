import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioActual } from "@/lib/data";
import { getContratistaTareas, getContratistaProgreso } from "@/lib/data-contratista";
import Topbar from "@/components/dashboard/Topbar";
import TaskRow from "@/components/dashboard/TaskRow";

const FILTROS = [
  { label: "Todas", value: "TODAS" },
  { label: "Pendientes", value: "PENDIENTE" },
  { label: "Reportadas", value: "REPORTADA" },
  { label: "Aprobadas", value: "APROBADA" },
  { label: "No aprobadas", value: "NO_APROBADA" },
];

export default async function ContratistaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;

  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const [tareas, progreso] = await Promise.all([
    getContratistaTareas(usuario.id, usuario.constructora_id, estado),
    getContratistaProgreso(usuario.id),
  ]);

  const estadoActivo = estado ?? "TODAS";

  return (
    <>
      <Topbar title="Mis tareas" subtitle="Resumen de trabajo" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Progress summary */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Progreso aprobado */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Progreso aprobado</span>
              <span className="text-2xl font-bold text-green-600">
                {progreso.porcentajeAprobado}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progreso.porcentajeAprobado}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {progreso.aprobadas} de {progreso.total} tareas aprobadas
            </p>
          </div>

          {/* Progreso reportado */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600">Progreso reportado</span>
              <span className="text-2xl font-bold text-blue-600">
                {progreso.porcentajeReportado}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progreso.porcentajeReportado}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Incluye aprobadas y pendientes de revisión
            </p>
          </div>
        </div>

        {/* Task count badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {progreso.aprobadas} aprobadas
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {progreso.reportadas} reportadas
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {progreso.pendientes} pendientes
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {progreso.noAprobadas} no aprobadas
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTROS.map((f) => {
            const isActive = estadoActivo === f.value;
            return (
              <Link
                key={f.value}
                href={f.value === "TODAS" ? "/contratista" : `/contratista?estado=${f.value}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* Task list */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {tareas.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              No hay tareas en esta categoría
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-50">
              {tareas.map((t) => (
                <div key={t.id}>
                  <TaskRow
                    id={t.id}
                    name={t.nombre}
                    project={t.proyecto}
                    unit={`${t.edificio} · Apto ${t.unidad}`}
                    status={t.estado as "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA"}
                    semaforo={t.semaforo as "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto"}
                    daysLeft={t.diasRestantes}
                  />
                  {/* Rejection justification */}
                  {t.estado === "NO_APROBADA" && t.justificacion && (
                    <div className="mx-4 mb-3 px-3 py-2 rounded-lg border border-red-200 bg-red-50">
                      <p className="text-xs font-medium text-red-700 mb-0.5">
                        Motivo de rechazo
                      </p>
                      <p className="text-xs text-red-600 line-clamp-2">
                        {t.justificacion}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
