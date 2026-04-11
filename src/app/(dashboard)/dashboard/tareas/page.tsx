import { redirect } from "next/navigation";
import { getTareasFiltradas, getUsuarioActual } from "@/lib/data";
import Topbar from "@/components/dashboard/Topbar";
import TaskRow from "@/components/dashboard/TaskRow";
import { Filter, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

const filters = [
  { label: "Todas", value: "ALL" },
  { label: "Reportadas", value: "REPORTADA" },
  { label: "No aprobadas", value: "NO_APROBADA" },
  { label: "Pendientes", value: "PENDIENTE" },
  { label: "Aprobadas", value: "APROBADA" },
];

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { estado } = await searchParams;
  const activeFilter = estado ?? "ALL";

  const tareas = await getTareasFiltradas(usuario.constructora_id, activeFilter, usuario.id, usuario.rol);

  return (
    <>
      <Topbar title="Tareas" subtitle="Seguimiento de todas las tareas" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <Link
                key={f.value}
                href={f.value === "ALL" ? "/dashboard/tareas" : `/dashboard/tareas?estado=${f.value}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
              Filtrar
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 transition-colors cursor-pointer">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Ordenar
            </button>
          </div>
        </div>

        {/* Tasks list */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm font-semibold text-slate-700">{tareas.length} tareas</span>
            <div className="flex items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-700" />Verde intenso</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Verde</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />Amarillo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Rojo</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-900" />Vinotinto</span>
            </div>
          </div>

          {tareas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No hay tareas con este estado
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {tareas.map((t) => (
                <TaskRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  project={t.project}
                  unit={t.unit}
                  status={t.status}
                  semaforo={t.semaforo}
                  daysLeft={t.daysLeft}
                  contractor={t.contractor}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
