import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ScoreGauge from "@/components/dashboard/ScoreGauge";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

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

export default async function ContratistasGlobalPage() {
  const contratistas = await prisma.contratista.findMany({
    include: {
      usuario: {
        select: {
          nombre: true,
          email: true,
          rol_ref: { select: { nombre: true } },
          constructora: { select: { id: true, nombre: true } },
          tareas_asignadas: { select: { estado: true } },
          obreros_a_cargo: { select: { id: true } },
        },
      },
    },
    orderBy: { score_total: "desc" },
  });

  return (
    <>
      <Topbar
        title="Ranking global de contratistas"
        subtitle={`${contratistas.length} contratistas en todas las constructoras`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {contratistas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Sin contratistas registrados aún.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {contratistas.map((c) => {
              const completadas = c.usuario.tareas_asignadas.filter((t) => t.estado === "APROBADA").length;
              const enProgreso = c.usuario.tareas_asignadas.filter(
                (t) => t.estado !== "APROBADA" && t.estado !== "NO_APROBADA",
              ).length;

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
                        {c.usuario.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate">{c.usuario.nombre}</div>
                        <div className="text-xs text-slate-500 truncate">{c.usuario.email}</div>
                        <div className="text-[10px] font-semibold text-red-600 mt-0.5 truncate">
                          📍 {c.usuario.constructora.nombre}
                        </div>
                      </div>
                    </div>
                    <ScoreChip score={c.score_total} />
                  </div>

                  <ScoreGauge
                    name={c.usuario.nombre}
                    score={c.score_total}
                    cumplimiento={c.score_cumplimiento}
                    calidad={c.score_calidad}
                    velocidad={c.score_velocidad_correccion}
                  />

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900 tabular-nums">{completadas}</div>
                      <div className="text-[10px] text-slate-500">Completadas</div>
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-slate-900 tabular-nums">{enProgreso}</div>
                      <div className="text-[10px] text-slate-500">En progreso</div>
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                        {c.usuario.obreros_a_cargo.length}
                      </div>
                      <div className="text-[10px] text-slate-500">Obreros</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
