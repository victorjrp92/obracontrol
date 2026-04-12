import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsuarioActual } from "@/lib/data";
import { getDirectivoStats, getProyectosResumen } from "@/lib/data-directivo";
import Topbar from "@/components/dashboard/Topbar";
import StatCard from "@/components/dashboard/StatCard";
import ProgressBar from "@/components/dashboard/ProgressBar";
import {
  FolderOpen,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

const semaforoMap: Record<string, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

export default async function DirectivoDashboardPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const cid = usuario.constructora_id;

  const [stats, proyectos] = await Promise.all([
    getDirectivoStats(cid),
    getProyectosResumen(cid),
  ]);

  const statCards = [
    {
      icon: FolderOpen,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
      label: "Proyectos activos",
      value: String(stats.proyectosActivos),
    },
    {
      icon: TrendingUp,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      label: "Progreso promedio",
      value: `${stats.progresoPromedio}%`,
    },
    {
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      label: "Tareas aprobadas",
      value: String(stats.tareasAprobadas),
      sub: `de ${stats.tareasTotal} totales`,
    },
    {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
      label: "Proyectos en riesgo",
      value: String(stats.proyectosEnRiesgo),
      sub: ">30% tareas críticas",
    },
  ];

  return (
    <>
      <Topbar
        title="Vista ejecutiva"
        subtitle={`Resumen general · ${usuario.constructora?.nombre ?? "Seiricon"}`}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {statCards.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Project list */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
          <h2 className="font-bold text-slate-800 mb-5">Proyectos activos</h2>

          {proyectos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              Sin proyectos activos
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {proyectos.map((p) => {
                const dotColor = semaforoMap[p.semaforo] ?? "bg-green-500";
                const fechaFin = p.fechaFin
                  ? new Date(p.fechaFin).toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Sin fecha";

                return (
                  <Link
                    key={p.id}
                    href={`/directivo/proyecto/${p.id}`}
                    className="group block bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
                        />
                        <span className="font-semibold text-slate-800 truncate group-hover:text-blue-700">
                          {p.nombre}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-500">{fechaFin}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      </div>
                    </div>

                    <ProgressBar
                      label=""
                      reported={p.progreso.reportado}
                      approved={p.progreso.aprobado}
                      semaforoColor={p.semaforo}
                    />

                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>{p.totalEdificios} edificios</span>
                      <span>{p.totalUnidades} unidades</span>
                      <span className="font-semibold text-slate-700">
                        {p.progreso.aprobado}% aprobado
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
