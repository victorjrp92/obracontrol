import { redirect } from "next/navigation";
import { getContratistas, getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import ScoreGauge from "@/components/dashboard/ScoreGauge";
import { Minus, TrendingDown, TrendingUp, UserPlus } from "lucide-react";

const ROL_LABELS: Record<string, string> = {
  CONTRATISTA_INSTALADOR: "Contratista instalador",
  CONTRATISTA_LUSTRADOR: "Contratista lustrador",
  ADMIN: "Administrador",
  COORDINADOR: "Coordinador",
};

function ScoreChip({ score }: { score: number }) {
  if (score >= 85) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" />Excelente
    </span>
  );
  if (score >= 70) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
      <TrendingUp className="w-3 h-3" />Bueno
    </span>
  );
  if (score >= 55) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
      <Minus className="w-3 h-3" />Regular
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
      <TrendingDown className="w-3 h-3" />Bajo
    </span>
  );
}

export default async function ContratistasPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const contratistas = await getContratistas(usuario.constructora_id);

  return (
    <>
      <Topbar title="Contratistas" subtitle="Score y desempeño del equipo" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            {contratistas.length} contratista{contratistas.length !== 1 ? "s" : ""} activo{contratistas.length !== 1 ? "s" : ""}
          </p>
          <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">
            <UserPlus className="w-4 h-4" />
            Agregar contratista
          </button>
        </div>

        {contratistas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <UserPlus className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sin contratistas registrados</p>
            <p className="text-sm mt-1">Agrega contratistas para ver su desempeño</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {contratistas.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                      {c.nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{c.nombre}</div>
                      <div className="text-xs text-slate-500">{ROL_LABELS[c.rol] ?? c.rol}</div>
                    </div>
                  </div>
                  <ScoreChip score={c.score_total} />
                </div>

                {/* Score gauge */}
                <ScoreGauge
                  name={c.nombre}
                  score={c.score_total}
                  cumplimiento={c.score_cumplimiento}
                  calidad={c.score_calidad}
                  velocidad={c.score_velocidad_correccion}
                />

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900 tabular-nums">{c.tasksCompleted}</div>
                    <div className="text-[10px] text-slate-500">Tareas completadas</div>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-slate-900 tabular-nums">{c.tasksPending}</div>
                    <div className="text-[10px] text-slate-500">En progreso</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
