import { redirect } from "next/navigation";
import { getTareasFiltradas, getUsuarioActual, getProyectosActivos } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import TareasTable from "@/components/dashboard/TareasTable";
import Link from "next/link";
import ProjectSelect from "./ProjectSelect";
import FaseSelect from "./FaseSelect";

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
  searchParams: Promise<{ estado?: string; proyecto?: string; fase?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { estado, proyecto, fase } = await searchParams;
  const activeFilter = estado ?? "REPORTADA";
  const activeProyecto = proyecto ?? "";
  const activeFase = fase ?? "";

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );

  const [tareas, proyectos, fases] = await Promise.all([
    getTareasFiltradas(
      usuario.constructora_id,
      activeFilter,
      usuario.id,
      usuario.rol_ref.nivel_acceso,
      activeProyecto || undefined,
      accessible,
      activeFase || undefined,
    ),
    getProyectosActivos(usuario.constructora_id, accessible),
    prisma.fase.findMany({
      where: {
        proyecto: {
          constructora_id: usuario.constructora_id,
          estado: "ACTIVO",
          ...(accessible !== "ALL" ? { id: { in: accessible } } : {}),
        },
      },
      select: { id: true, nombre: true },
      distinct: ["nombre"],
      orderBy: { orden: "asc" },
    }),
  ]);

  function buildHref(newEstado: string) {
    const sp = new URLSearchParams();
    sp.set("estado", newEstado);
    if (activeProyecto) sp.set("proyecto", activeProyecto);
    if (activeFase) sp.set("fase", activeFase);
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
            {fases.length > 1 && (
              <FaseSelect
                fases={fases}
                activeFase={activeFase}
                activeFilter={activeFilter}
                activeProyecto={activeProyecto}
              />
            )}
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

        {/* Tasks table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">{tareas.length} tareas</span>
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
