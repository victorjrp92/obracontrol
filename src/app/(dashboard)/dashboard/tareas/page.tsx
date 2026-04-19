import { redirect } from "next/navigation";
import { getTareasFiltradas, getUsuarioActual, getProyectosActivos } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import TareasTable from "@/components/dashboard/TareasTable";
import Link from "next/link";
import ProjectSelect from "./ProjectSelect";

const filters = [
  { label: "Todas", value: "ALL" },
  { label: "Pendientes", value: "PENDIENTE" },
  { label: "Reportadas", value: "REPORTADA" },
  { label: "Aprobadas", value: "APROBADA" },
  { label: "No aprobadas", value: "NO_APROBADA" },
];

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; proyecto?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { estado, proyecto } = await searchParams;
  const activeFilter = estado ?? "REPORTADA";
  const activeProyecto = proyecto ?? "";

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );

  const [tareas, proyectos] = await Promise.all([
    getTareasFiltradas(
      usuario.constructora_id,
      activeFilter,
      usuario.id,
      usuario.rol_ref.nivel_acceso,
      activeProyecto || undefined,
      accessible,
    ),
    getProyectosActivos(usuario.constructora_id, accessible),
  ]);

  // Build href preserving both filters
  function buildHref(newEstado: string) {
    const sp = new URLSearchParams();
    sp.set("estado", newEstado);
    if (activeProyecto) sp.set("proyecto", activeProyecto);
    return `/dashboard/tareas?${sp.toString()}`;
  }

  return (
    <>
      <Topbar title="Tareas" subtitle="Seguimiento de todas las tareas" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <Link
                key={f.value}
                href={buildHref(f.value)}
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
          <div className="flex items-center gap-3">
            {proyectos.length > 1 && (
              <ProjectSelect
                proyectos={proyectos}
                activeProyecto={activeProyecto}
                activeFilter={activeFilter}
              />
            )}
            <span className="text-xs text-slate-400">{tareas.length} resultado{tareas.length !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Tasks table grouped by phase */}
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

          <TareasTable
            tareas={tareas.map((t) => ({
              id: t.id,
              nombre: t.nombre,
              contratista: t.contratista,
              diasEstimados: t.diasEstimados,
              plazo: t.plazo,
              estado: t.estado,
              faseNombre: t.faseNombre,
              faseOrden: t.faseOrden,
            }))}
          />
        </div>
      </main>
    </>
  );
}
