import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getProyectoDetalle } from "@/lib/data-detail";
import { getAccessibleProjectIds } from "@/lib/access";
import { calcularProgreso } from "@/lib/scoring";
import Topbar from "@/components/dashboard/Topbar";
import Link from "next/link";
import { ArrowLeft, Building2, Calendar, CheckCircle2, Clock, Layers, Trees, Settings2 } from "lucide-react";
import EditProyecto from "./EditProyecto";

type SemaforoLevel = "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto";

type TareaType = {
  id: string;
  nombre: string;
  estado: string;
  tiempo_acordado_dias: number;
  asignado_usuario: { id: string; nombre: string } | null;
  fase: { id: string; nombre: string; orden: number } | null;
};

type SelectedUnidadType = {
  nombre: string;
  edificioNombre: string;
  pisoNumero: number;
  tareas: TareaType[];
};

function getUnidadColor(tareas: { estado: string }[]): string {
  if (tareas.length === 0) return "bg-slate-100 text-slate-400";
  const aprobadas = tareas.filter((t) => t.estado === "APROBADA").length;
  const noAprobadas = tareas.filter((t) => t.estado === "NO_APROBADA").length;
  const pct = aprobadas / tareas.length;
  if (pct === 1) return "bg-green-600 text-white";
  if (noAprobadas > 0) return "bg-red-100 text-red-700 border border-red-300";
  if (pct >= 0.5) return "bg-green-100 text-green-700";
  if (pct > 0) return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-600";
}

function UnidadDetailPanel({
  selectedUnidad,
  projectId,
}: {
  selectedUnidad: SelectedUnidadType;
  projectId: string;
}) {
  const estados = ["PENDIENTE", "REPORTADA", "APROBADA", "NO_APROBADA"] as const;
  const labels: Record<string, string> = {
    PENDIENTE: "Pendientes",
    REPORTADA: "Reportadas",
    APROBADA: "Aprobadas",
    NO_APROBADA: "No aprobadas",
  };
  const colors: Record<string, string> = {
    PENDIENTE: "text-slate-600 bg-slate-100",
    REPORTADA: "text-blue-700 bg-blue-50",
    APROBADA: "text-green-700 bg-green-50",
    NO_APROBADA: "text-red-700 bg-red-50",
  };
  const dotColors: Record<string, string> = {
    PENDIENTE: "bg-slate-400",
    REPORTADA: "bg-blue-500",
    APROBADA: "bg-green-500",
    NO_APROBADA: "bg-red-500",
  };

  // Group tasks by fase, then by estado within each fase
  const faseMap = new Map<
    string,
    { id: string; nombre: string; orden: number; tareas: TareaType[] }
  >();
  const sinFaseTareas: TareaType[] = [];

  for (const tarea of selectedUnidad.tareas) {
    if (tarea.fase) {
      const key = tarea.fase.id;
      if (!faseMap.has(key)) {
        faseMap.set(key, {
          id: tarea.fase.id,
          nombre: tarea.fase.nombre,
          orden: tarea.fase.orden,
          tareas: [],
        });
      }
      faseMap.get(key)!.tareas.push(tarea);
    } else {
      sinFaseTareas.push(tarea);
    }
  }

  // Sort phases by orden
  const fasesOrdenadas = Array.from(faseMap.values()).sort(
    (a, b) => a.orden - b.orden
  );

  // If there are tasks without a fase, add them as a final group
  if (sinFaseTareas.length > 0) {
    fasesOrdenadas.push({
      id: "__sin_fase__",
      nombre: "Sin fase",
      orden: Infinity,
      tareas: sinFaseTareas,
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">
            Apto {selectedUnidad.nombre}
          </h2>
          <p className="text-sm text-slate-500">
            {selectedUnidad.edificioNombre} · Piso {selectedUnidad.pisoNumero} ·{" "}
            {selectedUnidad.tareas.length} tareas
          </p>
        </div>
        <Link
          href={`/dashboard/proyectos/${projectId}`}
          className="text-xs text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg"
        >
          Cerrar
        </Link>
      </div>

      {fasesOrdenadas.length > 0
        ? fasesOrdenadas.map((fase) => (
            <div key={fase.id} className="mb-5 last:mb-0">
              {/* Phase header */}
              <div className="flex items-center gap-2 mb-3 border-l-4 border-blue-500 pl-3">
                <span className="text-sm font-bold text-slate-800">
                  {fase.nombre}
                </span>
                <span className="text-xs text-slate-400">
                  ({fase.tareas.length})
                </span>
              </div>

              {/* Estado groups within this phase */}
              {estados.map((estado) => {
                const tareasEstado = fase.tareas.filter(
                  (t) => t.estado === estado
                );
                if (tareasEstado.length === 0) return null;
                return (
                  <div key={estado} className="mb-3 last:mb-0 ml-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${dotColors[estado]}`}
                      />
                      <span className="text-sm font-semibold text-slate-700">
                        {labels[estado]}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[estado]}`}
                      >
                        {tareasEstado.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 pl-4">
                      {tareasEstado.map((t) => (
                        <Link
                          key={t.id}
                          href={`/dashboard/tareas/${t.id}`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors group"
                        >
                          <span className="text-sm text-slate-800 group-hover:text-blue-600">
                            {t.nombre}
                          </span>
                          <div className="flex items-center gap-2">
                            {t.asignado_usuario && (
                              <span className="text-xs text-slate-400">
                                {t.asignado_usuario.nombre}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {t.tiempo_acordado_dias} {t.tiempo_acordado_dias === 1 ? "Día" : "Días"}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        : null}

      {selectedUnidad.tareas.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          No hay tareas en esta unidad
        </p>
      )}
    </>
  );
}

export default async function ProyectoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unidad?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const { id } = await params;

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (accessible !== "ALL" && !accessible.includes(id)) {
    redirect("/dashboard/proyectos");
  }

  const { unidad: unidadId } = await searchParams;
  const proyecto = await getProyectoDetalle(id, usuario.constructora_id);
  if (!proyecto) notFound();

  // Find selected unidad if param present
  let selectedUnidad: SelectedUnidadType | null = null;
  if (unidadId) {
    for (const edificio of proyecto.edificios) {
      for (const piso of edificio.pisos) {
        const u = piso.unidades.find((u) => u.id === unidadId);
        if (u) {
          selectedUnidad = {
            nombre: u.nombre,
            edificioNombre: edificio.nombre,
            pisoNumero: piso.numero,
            tareas: u.espacios.flatMap((e) =>
              e.tareas.map((t) => ({
                id: t.id,
                nombre: `${e.nombre} — ${t.nombre}`,
                estado: t.estado,
                tiempo_acordado_dias: t.tiempo_acordado_dias,
                asignado_usuario: t.asignado_usuario,
                fase: t.fase,
              }))
            ),
          };
          break;
        }
      }
      if (selectedUnidad) break;
    }
  }

  const formatDate = (d: Date | string | null) => {
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  };

  // Compute progress by unit type
  const progresoByTipo: { nombre: string; aprobadas: number; total: number; porcentaje: number }[] = [];
  const tipoGroups = new Map<string, { nombre: string; tareas: { estado: string }[] }>();
  for (const edificio of proyecto.edificios) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        const tipoNombre = unidad.tipo_unidad?.nombre ?? "Sin tipo";
        if (!tipoGroups.has(tipoNombre)) {
          tipoGroups.set(tipoNombre, { nombre: tipoNombre, tareas: [] });
        }
        const group = tipoGroups.get(tipoNombre)!;
        for (const espacio of unidad.espacios) {
          for (const tarea of espacio.tareas) {
            group.tareas.push(tarea);
          }
        }
      }
    }
  }
  for (const [, group] of tipoGroups) {
    const prog = calcularProgreso(group.tareas);
    progresoByTipo.push({ nombre: group.nombre, aprobadas: prog.aprobadas, total: prog.total, porcentaje: prog.porcentajeAprobado });
  }

  return (
    <>
      <Topbar title={proyecto.nombre} subtitle={`${proyecto.totalTareas} tareas · ${proyecto.edificios.length} torre(s)`} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Back link */}
        <Link
          href="/dashboard/proyectos"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a proyectos
        </Link>

        {/* Edit project + audit log (admin can edit, directivo can view log) */}
        {["ADMIN_GENERAL", "DIRECTIVO"].includes(usuario.rol_ref.nivel_acceso) && (
          <div className="mb-4">
            <EditProyecto
              proyecto={{
                id,
                nombre: proyecto.nombre,
                dias_habiles_semana: proyecto.dias_habiles_semana,
                fecha_inicio: proyecto.fecha_inicio?.toISOString() ?? null,
                fecha_fin_estimada: proyecto.fecha_fin_estimada?.toISOString() ?? null,
                estado: proyecto.estado,
              }}
              canEdit={usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL"}
            />
            {usuario.rol_ref.nivel_acceso === "ADMIN_GENERAL" && (
              <Link
                href={`/dashboard/proyectos/${id}/editar`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors mt-2"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Edición completa (fases, tipos, tareas)
              </Link>
            )}
          </div>
        )}

        {/* Progress summary */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">Progreso aprobado</div>
              <div className="text-3xl font-extrabold text-slate-900">{proyecto.progreso.porcentajeAprobado}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Reportado</div>
              <div className="text-3xl font-extrabold text-blue-400">{proyecto.progreso.porcentajeReportado}%</div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-300" style={{ width: `${proyecto.progreso.porcentajeReportado}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: `${proyecto.progreso.porcentajeAprobado}%` }} />
              </div>
            </div>
            <div className="flex gap-4 text-sm text-slate-500">
              <span><strong className="text-green-600">{proyecto.progreso.aprobadas}</strong> aprobadas</span>
              <span><strong className="text-slate-800">{proyecto.progreso.total}</strong> total</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              Inicio: {formatDate(proyecto.fecha_inicio)}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              Fin estimado: {formatDate(proyecto.fecha_fin_estimada)}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Layers className="w-4 h-4 text-slate-400" />
              Fases: {proyecto.fases.map((f) => f.nombre).join(", ")}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              {proyecto.dias_habiles_semana} días hábiles/semana
            </div>
          </div>
        </div>

        {/* Progress by unit type */}
        {progresoByTipo.length > 1 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            {progresoByTipo.map((tipo) => (
              <div key={tipo.nombre} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="text-xs text-slate-500 mb-1">{tipo.nombre}</div>
                <div className="text-xl font-bold text-slate-900">{tipo.porcentaje}%</div>
                <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: `${tipo.porcentaje}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{tipo.aprobadas}/{tipo.total} tareas</div>
              </div>
            ))}
          </div>
        )}

        {/* Split-view: buildings grid + unit detail */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: buildings grid */}
          <div className={selectedUnidad ? "md:w-[60%]" : "w-full"}>
            {/* Regular buildings */}
            {proyecto.edificios.filter((e) => !e.es_zona_comun).map((edificio) => (
              <div key={edificio.id} className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-slate-900 text-base sm:text-lg">{edificio.nombre}</h2>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full ml-2">
                    {edificio.pisos.length} pisos
                  </span>
                </div>

                {/* Grid by floor */}
                <div className="flex flex-col gap-3 overflow-x-auto">
                  {edificio.pisos.slice().reverse().map((piso) => {
                    return (
                      <div key={piso.id} className="flex items-center gap-2 sm:gap-3">
                        <div className="w-12 sm:w-16 text-[10px] sm:text-xs font-semibold text-slate-500 text-right flex-shrink-0">
                          Piso {piso.numero}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 flex-wrap flex-1">
                          {piso.unidades.map((unidad) => {
                            const tareas = unidad.espacios.flatMap((e) => e.tareas);
                            const progreso = calcularProgreso(tareas);
                            const colorClass = getUnidadColor(tareas);

                            return (
                              <Link
                                key={unidad.id}
                                href={`/dashboard/proyectos/${proyecto.id}?unidad=${unidad.id}`}
                                className={`w-14 h-12 sm:w-20 sm:h-16 rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-[10px] sm:text-xs font-medium hover:shadow-md transition-all flex-shrink-0 ${colorClass}`}
                                title={`Apto ${unidad.nombre}: ${progreso.porcentajeAprobado}% aprobado (${progreso.aprobadas}/${progreso.total})`}
                              >
                                <span className="font-bold">{unidad.nombre}</span>
                                <span className="text-[9px] sm:text-[10px] opacity-75">{progreso.porcentajeAprobado}%</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-slate-100 text-[9px] sm:text-[10px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> 100%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> ≥50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> &lt;50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> No aprobadas</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Sin progreso</span>
                </div>
              </div>
            ))}

            {/* Zonas comunes */}
            {proyecto.edificios.filter((e) => e.es_zona_comun).map((edificio) => (
              <div key={edificio.id} className="bg-white rounded-2xl border border-green-100 p-5 sm:p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trees className="w-5 h-5 text-green-600" />
                  <h2 className="font-bold text-slate-900 text-base sm:text-lg">Zonas Comunes</h2>
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-2">
                    Área compartida
                  </span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {edificio.pisos.flatMap((piso) =>
                    piso.unidades.map((unidad) => {
                      const tareas = unidad.espacios.flatMap((e) => e.tareas);
                      const progreso = calcularProgreso(tareas);
                      const colorClass = getUnidadColor(tareas);

                      return (
                        <Link
                          key={unidad.id}
                          href={`/dashboard/proyectos/${proyecto.id}?unidad=${unidad.id}`}
                          className={`px-4 py-3 rounded-xl flex flex-col items-center justify-center text-xs font-medium hover:shadow-md transition-all min-w-[100px] ${colorClass}`}
                          title={`${unidad.nombre}: ${progreso.porcentajeAprobado}% aprobado (${progreso.aprobadas}/${progreso.total})`}
                        >
                          <Trees className="w-4 h-4 mb-1 opacity-70" />
                          <span className="font-bold text-center leading-tight">{unidad.nombre}</span>
                          <span className="text-[10px] opacity-75 mt-0.5">{progreso.porcentajeAprobado}%</span>
                        </Link>
                      );
                    })
                  )}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-green-100 text-[9px] sm:text-[10px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> 100%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> ≥50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> &lt;50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> No aprobadas</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Sin progreso</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: unit detail (desktop only) */}
          {selectedUnidad && (
            <div className="hidden md:block md:w-[40%]">
              <div className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto bg-white rounded-2xl border border-blue-200 p-5">
                <UnidadDetailPanel selectedUnidad={selectedUnidad} projectId={id} />
              </div>
            </div>
          )}

          {/* Mobile: unit detail below */}
          {selectedUnidad && (
            <div className="md:hidden">
              <div id="unidad-detail" className="bg-white rounded-2xl border border-blue-200 p-5 sm:p-6 mb-6 scroll-mt-4">
                <UnidadDetailPanel selectedUnidad={selectedUnidad} projectId={id} />
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
