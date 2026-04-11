import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getDashboardStats,
  getProyectosConProgreso,
  getTareasRecientes,
  getTopContratistas,
  getUsuarioActual,
} from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import ProgressBar from "@/components/dashboard/ProgressBar";
import ScoreGauge from "@/components/dashboard/ScoreGauge";
import TaskRow from "@/components/dashboard/TaskRow";
import { BarChart3, CheckCircle2, Clock, FolderOpen, TrendingUp, Users } from "lucide-react";

export default async function DashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const cid = usuario.constructora_id;

  const [stats, proyectos, tareasRecientes, topContratistas] = await Promise.all([
    getDashboardStats(cid),
    getProyectosConProgreso(cid),
    getTareasRecientes(cid, 8, usuario.id, usuario.rol),
    getTopContratistas(cid),
  ]);

  const total = stats.total;

  const statCards = [
    {
      icon: FolderOpen,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      label: "Proyectos activos",
      value: String(stats.proyectosActivos),
    },
    {
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      label: "Tareas aprobadas",
      value: String(stats.tareasAprobadas),
    },
    {
      icon: Clock,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-50",
      label: "Tareas reportadas",
      value: String(stats.tareasReportadas),
      sub: "Pendientes de revisión",
    },
    {
      icon: TrendingUp,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      label: "Progreso promedio",
      value: `${stats.porcentajeAprobado}%`,
    },
    {
      icon: Users,
      iconColor: "text-sky-600",
      iconBg: "bg-sky-50",
      label: "Contratistas activos",
      value: String(stats.contratistasActivos),
    },
    {
      icon: BarChart3,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      label: "Tareas en riesgo",
      value: String(stats.tareasEnRiesgo),
    },
  ];

  const taskBreakdown = [
    { label: "Aprobadas", value: stats.tareasAprobadas, color: "bg-green-500", pct: total > 0 ? Math.round((stats.tareasAprobadas / total) * 100) : 0 },
    { label: "Reportadas", value: stats.tareasReportadas, color: "bg-blue-500", pct: total > 0 ? Math.round((stats.tareasReportadas / total) * 100) : 0 },
    { label: "Pendientes", value: stats.tareasPendientes, color: "bg-slate-300", pct: total > 0 ? Math.round((stats.tareasPendientes / total) * 100) : 0 },
    { label: "No aprobadas", value: stats.tareasNoAprobadas, color: "bg-red-500", pct: total > 0 ? Math.round((stats.tareasNoAprobadas / total) * 100) : 0 },
  ];

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle={`Resumen general · ${usuario.constructora?.nombre ?? "Seiricon"}`}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Project progress */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <h2 className="font-bold text-slate-800 mb-5">Progreso por proyecto</h2>
            <div className="flex flex-col gap-6">
              {proyectos.map((p) => (
                <ProgressBar
                  key={p.id}
                  label={p.nombre}
                  reported={p.progreso.porcentajeReportado}
                  approved={p.progreso.porcentajeAprobado}
                  semaforoColor={p.semaforo}
                />
              ))}
              {proyectos.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Sin proyectos activos</p>
              )}
            </div>
          </div>

          {/* Task breakdown */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <h2 className="font-bold text-slate-800 mb-4">Estado de tareas</h2>
            <div className="flex flex-col gap-3">
              {taskBreakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`} />
                  <span className="text-sm text-slate-600 flex-1">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{item.value}</span>
                  <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Score de contratistas */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">Score de contratistas</h2>
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                Top {topContratistas.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {topContratistas.map((c) => (
                <ScoreGauge
                  key={c.id}
                  name={c.usuario.nombre}
                  score={c.score_total}
                  cumplimiento={c.score_cumplimiento}
                  calidad={c.score_calidad}
                  velocidad={c.score_velocidad_correccion}
                />
              ))}
              {topContratistas.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Sin contratistas registrados</p>
              )}
            </div>
          </div>

          {/* Recent tasks */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">Actividad reciente</h2>
              <Link href="/dashboard/tareas" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Ver todas
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-slate-50">
              {tareasRecientes.map((t) => (
                <TaskRow
                  key={t.id}
                  id={t.id}
                  name={t.nombre}
                  project={t.proyecto}
                  unit={t.unidad}
                  status={t.status as "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA"}
                  semaforo={t.semaforo as "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto"}
                  daysLeft={t.daysLeft}
                  contractor={t.contractor}
                />
              ))}
              {tareasRecientes.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Sin actividad reciente</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
