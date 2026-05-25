import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  XCircle,
} from "lucide-react";
import type { EstadoTarea } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const filters: { label: string; value: "ALL" | EstadoTarea }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Pendientes", value: "PENDIENTE" },
  { label: "Reportadas", value: "REPORTADA" },
  { label: "Rechazadas", value: "NO_APROBADA" },
];

const estadoConfig: Record<
  EstadoTarea,
  { label: string; class: string; Icon: typeof Clock }
> = {
  PENDIENTE: { label: "Pendiente", class: "text-slate-600 bg-slate-50 border-slate-200", Icon: Clock },
  REPORTADA: { label: "Reportada", class: "text-blue-600 bg-blue-50 border-blue-200", Icon: AlertTriangle },
  APROBADA: { label: "Aprobada", class: "text-green-600 bg-green-50 border-green-200", Icon: CheckCircle2 },
  NO_APROBADA: { label: "Rechazada", class: "text-red-600 bg-red-50 border-red-200", Icon: XCircle },
};

interface TareaConJerarquia {
  id: string;
  nombre: string;
  estado: EstadoTarea;
  proyectoId: string;
  proyectoNombre: string;
  edificioId: string;
  edificioNombre: string;
  unidadId: string;
  unidadNombre: string;
  espacioId: string;
  espacioNombre: string;
}

export default async function MisTareasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const { estado } = await searchParams;
  const activeFilter: "ALL" | EstadoTarea = (estado as "ALL" | EstadoTarea | undefined) ?? "ALL";

  const tareas = await prisma.tarea.findMany({
    where: {
      asignado_a: usuario.id,
      ...(activeFilter !== "ALL" ? { estado: activeFilter } : {}),
    },
    include: {
      espacio: {
        include: {
          unidad: {
            include: {
              piso: {
                include: {
                  edificio: {
                    include: { proyecto: { select: { id: true, nombre: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updated_at: "desc" }],
  });

  const flat: TareaConJerarquia[] = tareas.map((t) => {
    const edificio = t.espacio.unidad.piso.edificio;
    const proyecto = edificio.proyecto;
    return {
      id: t.id,
      nombre: t.nombre,
      estado: t.estado,
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      edificioId: edificio.id,
      edificioNombre: edificio.nombre,
      unidadId: t.espacio.unidad.id,
      unidadNombre: t.espacio.unidad.nombre,
      espacioId: t.espacio.id,
      espacioNombre: t.espacio.nombre,
    };
  });

  // Group: proyecto > edificio > unidad > espacio
  const grouped = new Map<
    string,
    {
      proyectoNombre: string;
      edificios: Map<
        string,
        {
          edificioNombre: string;
          unidades: Map<
            string,
            {
              unidadNombre: string;
              espacios: Map<string, { espacioNombre: string; tareas: TareaConJerarquia[] }>;
            }
          >;
        }
      >;
    }
  >();

  for (const t of flat) {
    if (!grouped.has(t.proyectoId)) {
      grouped.set(t.proyectoId, { proyectoNombre: t.proyectoNombre, edificios: new Map() });
    }
    const proyecto = grouped.get(t.proyectoId)!;
    if (!proyecto.edificios.has(t.edificioId)) {
      proyecto.edificios.set(t.edificioId, { edificioNombre: t.edificioNombre, unidades: new Map() });
    }
    const edificio = proyecto.edificios.get(t.edificioId)!;
    if (!edificio.unidades.has(t.unidadId)) {
      edificio.unidades.set(t.unidadId, { unidadNombre: t.unidadNombre, espacios: new Map() });
    }
    const unidad = edificio.unidades.get(t.unidadId)!;
    if (!unidad.espacios.has(t.espacioId)) {
      unidad.espacios.set(t.espacioId, { espacioNombre: t.espacioNombre, tareas: [] });
    }
    unidad.espacios.get(t.espacioId)!.tareas.push(t);
  }

  return (
    <>
      <Topbar title="Mis tareas" subtitle={`${flat.length} tarea${flat.length === 1 ? "" : "s"}`} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={`/dashboard/mis-tareas${f.value === "ALL" ? "" : `?estado=${f.value}`}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                activeFilter === f.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {flat.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No tienes tareas en este filtro.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(grouped.entries()).map(([proyectoId, proyecto]) => (
              <div key={proyectoId} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <h2 className="font-bold text-slate-800 text-sm">{proyecto.proyectoNombre}</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.from(proyecto.edificios.entries()).map(([edificioId, edificio]) => (
                    <div key={edificioId} className="px-5 py-3">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {edificio.edificioNombre}
                      </h3>
                      <div className="flex flex-col gap-3 pl-2 border-l-2 border-slate-100">
                        {Array.from(edificio.unidades.entries()).map(([unidadId, unidad]) => (
                          <div key={unidadId}>
                            <div className="text-xs font-medium text-slate-600 mb-1">
                              Apto {unidad.unidadNombre}
                            </div>
                            <div className="flex flex-col gap-2 pl-3">
                              {Array.from(unidad.espacios.entries()).map(([espacioId, espacio]) => (
                                <div key={espacioId}>
                                  <div className="text-[11px] text-slate-400 mb-1">{espacio.espacioNombre}</div>
                                  <ul className="flex flex-col gap-1.5">
                                    {espacio.tareas.map((tarea) => {
                                      const est = estadoConfig[tarea.estado];
                                      const EstIcon = est.Icon;
                                      return (
                                        <li key={tarea.id}>
                                          <Link
                                            href={`/dashboard/mis-tareas/${tarea.id}`}
                                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                                          >
                                            <span className="text-sm text-slate-800 truncate">{tarea.nombre}</span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${est.class}`}
                                              >
                                                <EstIcon className="w-3 h-3" />
                                                {est.label}
                                              </span>
                                              <ChevronRight className="w-4 h-4 text-slate-400" />
                                            </div>
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
