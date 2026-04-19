import { redirect } from "next/navigation";
import { getProyectosConProgreso, getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { getPermissions } from "@/lib/permissions";
import Topbar from "@/components/dashboard/Topbar";
import { Building2, Calendar, ChevronRight, FolderPlus } from "lucide-react";
import Link from "next/link";

type SemaforoLevel = "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto";

const semaforoColors: Record<SemaforoLevel, { dot: string; label: string; bg: string; text: string }> = {
  "verde-intenso": { dot: "bg-green-700", label: "Adelantado", bg: "bg-green-50", text: "text-green-700" },
  verde: { dot: "bg-green-500", label: "A tiempo", bg: "bg-green-50", text: "text-green-600" },
  amarillo: { dot: "bg-yellow-400", label: "Alerta", bg: "bg-yellow-50", text: "text-yellow-600" },
  rojo: { dot: "bg-red-500", label: "Retraso", bg: "bg-red-50", text: "text-red-600" },
  vinotinto: { dot: "bg-red-900", label: "Crítico", bg: "bg-red-50", text: "text-red-900" },
};

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", { month: "short", year: "numeric" }).format(new Date(date));
}

const SUBTIPO_LABELS: Record<string, string> = {
  APARTAMENTOS: "Apartamentos",
  CASAS: "Casas",
  OFICINAS: "Oficinas",
  MIXTO: "Mixto",
};

export default async function ProyectosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  const proyectosVisibles = await getProyectosConProgreso(
    usuario.constructora_id,
    accessible,
  );

  const permissions = getPermissions(usuario.rol_ref.nivel_acceso);
  const puedeCrearProyectos = permissions.canViewAllProjects && usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL";

  return (
    <>
      <Topbar title="Proyectos" subtitle="Gestión de proyectos activos" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">{proyectosVisibles.length} proyecto{proyectosVisibles.length !== 1 ? "s" : ""} activo{proyectosVisibles.length !== 1 ? "s" : ""}</p>
          {puedeCrearProyectos && (
            <Link
              href="/dashboard/proyectos/nuevo"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" />
              Nuevo proyecto
            </Link>
          )}
        </div>

        {proyectosVisibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FolderPlus className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">Sin proyectos activos</p>
            <p className="text-sm mt-1 mb-4">Crea tu primer proyecto para comenzar</p>
            {puedeCrearProyectos && (
              <Link
                href="/dashboard/proyectos/nuevo"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl"
              >
                <FolderPlus className="w-4 h-4" />
                Crear proyecto
              </Link>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {proyectosVisibles.map((p) => {
              const sem = semaforoColors[p.semaforo as SemaforoLevel] ?? semaforoColors.verde;
              const numEdificios = p.edificios.length;

              return (
                <Link
                  key={p.id}
                  href={`/dashboard/proyectos/${p.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all p-5 flex flex-col gap-4"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{p.nombre}</h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {SUBTIPO_LABELS[p.subtipo] ?? p.subtipo}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${sem.bg} ${sem.text} flex-shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sem.dot}`} />
                      {sem.label}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {numEdificios > 0 ? `${numEdificios} torre${numEdificios > 1 ? "s" : ""}` : "Sin torres"}
                    </div>
                    <div>{p.totalUnidades} unidades</div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(p.fecha_fin_estimada)}
                    </div>
                  </div>

                  {/* Task summary */}
                  <div className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg w-fit font-medium">
                    {p.progreso.total} tareas · {p.progreso.aprobadas} aprobadas
                  </div>

                  {/* Progress */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Progreso aprobado</span>
                      <span className="font-semibold text-slate-800">{p.progreso.porcentajeAprobado}%</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-blue-300"
                        style={{ width: `${p.progreso.porcentajeReportado}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-blue-600"
                        style={{ width: `${p.progreso.porcentajeAprobado}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Reportado: {p.progreso.porcentajeReportado}%</span>
                      <span>Aprobado: {p.progreso.porcentajeAprobado}%</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-end text-slate-400 group-hover:text-blue-600 transition-colors">
                    <span className="text-xs font-medium">Ver detalle</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
