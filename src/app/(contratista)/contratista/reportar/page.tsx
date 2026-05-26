import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  DoorOpen,
  Home,
  Layers,
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

interface TareaPlana {
  id: string;
  nombre: string;
  estado: EstadoTarea;
  proyectoId: string;
  proyectoNombre: string;
  edificioId: string;
  edificioNombre: string;
  pisoNumero: number;
  unidadId: string;
  unidadNombre: string;
  espacioNombre: string;
}

interface SearchParams {
  estado?: string;
  proyecto?: string;
  torre?: string;
  piso?: string;
  apto?: string;
}

function buildHref(
  base: SearchParams,
  overrides: Partial<SearchParams> & { clear?: Array<keyof SearchParams> },
): string {
  const params: Record<string, string> = {};
  for (const k of ["estado", "proyecto", "torre", "piso", "apto"] as const) {
    if (overrides.clear?.includes(k)) continue;
    const v = overrides[k] ?? base[k];
    if (v) params[k] = v;
  }
  const qs = new URLSearchParams(params).toString();
  return `/contratista/reportar${qs ? `?${qs}` : ""}`;
}

export default async function ReportarTareasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  const sp = await searchParams;
  const activeFilter: "ALL" | EstadoTarea =
    (sp.estado as "ALL" | EstadoTarea | undefined) ?? "ALL";

  const tareas = await prisma.tarea.findMany({
    where: {
      asignado_a: usuario.id,
      espacio: {
        unidad: {
          piso: {
            edificio: {
              proyecto: { constructora_id: usuario.constructora_id },
            },
          },
        },
      },
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

  const flat: TareaPlana[] = tareas.map((t) => {
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
      pisoNumero: t.espacio.unidad.piso.numero,
      unidadId: t.espacio.unidad.id,
      unidadNombre: t.espacio.unidad.nombre,
      espacioNombre: t.espacio.nombre,
    };
  });

  // ── Determinar nivel actual del drill-down ───────────────────────────────
  const proyectos = Array.from(
    new Map(flat.map((t) => [t.proyectoId, t.proyectoNombre])),
  ).map(([id, nombre]) => ({ id, nombre }));

  // Si solo hay 1 proyecto, lo saltamos automáticamente
  const proyectoId = sp.proyecto ?? (proyectos.length === 1 ? proyectos[0].id : undefined);
  const torreId = sp.torre;
  const pisoNum = sp.piso ? parseInt(sp.piso, 10) : undefined;
  const aptoId = sp.apto;

  const proyectoNombre = proyectos.find((p) => p.id === proyectoId)?.nombre;
  const filtroProyecto = proyectoId ? flat.filter((t) => t.proyectoId === proyectoId) : flat;
  const filtroTorre = torreId
    ? filtroProyecto.filter((t) => t.edificioId === torreId)
    : filtroProyecto;
  const torreNombre = filtroTorre[0]?.edificioNombre;
  const filtroPiso = pisoNum != null
    ? filtroTorre.filter((t) => t.pisoNumero === pisoNum)
    : filtroTorre;
  const filtroApto = aptoId ? filtroPiso.filter((t) => t.unidadId === aptoId) : filtroPiso;
  const aptoNombre = filtroApto[0]?.unidadNombre;

  // ── Render breadcrumb ────────────────────────────────────────────────────
  const crumbs: { label: string; href: string | null; icon: typeof Home }[] = [
    { label: "Inicio", href: buildHref(sp, { clear: ["proyecto", "torre", "piso", "apto"] }), icon: Home },
  ];
  if (proyectos.length > 1 && proyectoId) {
    crumbs.push({
      label: proyectoNombre ?? "Proyecto",
      href: buildHref(sp, { proyecto: proyectoId, clear: ["torre", "piso", "apto"] }),
      icon: Layers,
    });
  }
  if (torreId) {
    crumbs.push({
      label: torreNombre ?? "Torre",
      href: buildHref(sp, { torre: torreId, clear: ["piso", "apto"] }),
      icon: Building2,
    });
  }
  if (pisoNum != null) {
    crumbs.push({
      label: `Piso ${pisoNum}`,
      href: buildHref(sp, { piso: String(pisoNum), clear: ["apto"] }),
      icon: Layers,
    });
  }
  if (aptoId) {
    crumbs.push({
      label: `Apto ${aptoNombre ?? ""}`,
      href: null,
      icon: DoorOpen,
    });
  }

  // Marcar el último como no-link
  if (crumbs.length > 0) crumbs[crumbs.length - 1].href = null;

  // ── Determinar qué nivel mostrar ─────────────────────────────────────────
  const level: "proyectos" | "torres" | "pisos" | "aptos" | "tareas" =
    !proyectoId
      ? "proyectos"
      : !torreId
        ? "torres"
        : pisoNum == null
          ? "pisos"
          : !aptoId
            ? "aptos"
            : "tareas";

  return (
    <>
      <Topbar
        title="Reportar tareas"
        subtitle={`${flat.length} tarea${flat.length === 1 ? "" : "s"} ${activeFilter === "ALL" ? "asignadas" : "en este filtro"}`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={buildHref(sp, f.value === "ALL" ? { clear: ["estado"] } : { estado: f.value })}
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

        {/* Breadcrumb */}
        {crumbs.length > 1 && (
          <nav className="flex items-center gap-1 mb-4 text-xs text-slate-500 flex-wrap">
            {crumbs.map((c, i) => {
              const Icon = c.icon;
              const isLast = i === crumbs.length - 1;
              const content = (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isLast ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-slate-100"}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {c.label}
                </span>
              );
              return (
                <span key={i} className="inline-flex items-center gap-1">
                  {c.href ? <Link href={c.href}>{content}</Link> : content}
                  {!isLast && <ChevronRight className="w-3 h-3 text-slate-300" />}
                </span>
              );
            })}
          </nav>
        )}

        {/* Empty state */}
        {flat.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No tienes tareas en este filtro.</p>
          </div>
        ) : (
          <>
            {/* ── Nivel: Proyectos ─────────────────────────────────────── */}
            {level === "proyectos" && (
              <CardGrid>
                {proyectos.map((p) => {
                  const count = flat.filter((t) => t.proyectoId === p.id).length;
                  return (
                    <CascadaCard
                      key={p.id}
                      href={buildHref(sp, { proyecto: p.id })}
                      icon={Layers}
                      title={p.nombre}
                      subtitle={`${count} tarea${count === 1 ? "" : "s"}`}
                    />
                  );
                })}
              </CardGrid>
            )}

            {/* ── Nivel: Torres ─────────────────────────────────────────── */}
            {level === "torres" && (
              <CardGrid>
                {Array.from(new Map(filtroProyecto.map((t) => [t.edificioId, t.edificioNombre])).entries()).map(([id, nombre]) => {
                  const count = filtroProyecto.filter((t) => t.edificioId === id).length;
                  return (
                    <CascadaCard
                      key={id}
                      href={buildHref(sp, { torre: id })}
                      icon={Building2}
                      title={nombre}
                      subtitle={`${count} tarea${count === 1 ? "" : "s"}`}
                    />
                  );
                })}
              </CardGrid>
            )}

            {/* ── Nivel: Pisos ───────────────────────────────────────────── */}
            {level === "pisos" && (
              <CardGrid>
                {Array.from(new Set(filtroTorre.map((t) => t.pisoNumero)))
                  .sort((a, b) => a - b)
                  .map((p) => {
                    const count = filtroTorre.filter((t) => t.pisoNumero === p).length;
                    return (
                      <CascadaCard
                        key={p}
                        href={buildHref(sp, { piso: String(p) })}
                        icon={Layers}
                        title={`Piso ${p}`}
                        subtitle={`${count} tarea${count === 1 ? "" : "s"}`}
                      />
                    );
                  })}
              </CardGrid>
            )}

            {/* ── Nivel: Apartamentos ────────────────────────────────────── */}
            {level === "aptos" && (
              <CardGrid>
                {Array.from(new Map(filtroPiso.map((t) => [t.unidadId, t.unidadNombre])).entries())
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([id, nombre]) => {
                    const count = filtroPiso.filter((t) => t.unidadId === id).length;
                    return (
                      <CascadaCard
                        key={id}
                        href={buildHref(sp, { apto: id })}
                        icon={DoorOpen}
                        title={`Apto ${nombre}`}
                        subtitle={`${count} tarea${count === 1 ? "" : "s"}`}
                      />
                    );
                  })}
              </CardGrid>
            )}

            {/* ── Nivel: Tareas ──────────────────────────────────────────── */}
            {level === "tareas" && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Agrupado por espacio */}
                {Array.from(new Set(filtroApto.map((t) => t.espacioNombre))).map((esp) => (
                  <div key={esp} className="border-b border-slate-100 last:border-0">
                    <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {esp}
                    </div>
                    <ul>
                      {filtroApto
                        .filter((t) => t.espacioNombre === esp)
                        .map((t) => {
                          const est = estadoConfig[t.estado];
                          const EstIcon = est.Icon;
                          return (
                            <li key={t.id}>
                              <Link
                                href={`/contratista/reportar/${t.id}`}
                                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                              >
                                <span className="text-sm text-slate-800 truncate flex-1">
                                  {t.nombre}
                                </span>
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
            )}
          </>
        )}
      </main>
    </>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {children}
    </div>
  );
}

function CascadaCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof Home;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
    </Link>
  );
}
