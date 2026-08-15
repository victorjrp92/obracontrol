import Link from "next/link";
import { getObreroTareas, validateObreroToken, type ObreroTarea } from "@/lib/data-obrero";
import TareaCard from "@/components/obrero/TareaCard";
import { ClipboardList, ChevronRight, Building2, Layers, DoorOpen, Home, FolderOpen } from "lucide-react";

const ORDINALES = [
  "Primer", "Segundo", "Tercer", "Cuarto", "Quinto",
  "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo",
];
function pisoLabel(n: number): string {
  return ORDINALES[n - 1] ? `${ORDINALES[n - 1]} piso` : `Piso ${n}`;
}

type Nivel = "proyecto" | "edificio" | "piso" | "apto" | "espacio";

interface SearchParams {
  proyecto?: string;
  edificio?: string;
  piso?: string;
  apto?: string;
  espacio?: string;
}

function buildHref(
  token: string,
  base: SearchParams,
  set: Partial<SearchParams>,
): string {
  const params: Record<string, string> = {};
  for (const k of ["proyecto", "edificio", "piso", "apto", "espacio"] as const) {
    const v = set[k] ?? base[k];
    if (v) params[k] = v;
  }
  const qs = new URLSearchParams(params).toString();
  return `/o/${token}${qs ? `?${qs}` : ""}`;
}

// Llave + etiqueta de una tarea para una dimensión dada.
function dimKey(t: ObreroTarea, nivel: Nivel): string {
  switch (nivel) {
    case "proyecto": return t.proyectoId;
    case "edificio": return t.edificioId;
    case "piso": return String(t.pisoNumero);
    case "apto": return t.unidadId;
    case "espacio": return t.espacioId;
  }
}
function dimLabel(t: ObreroTarea, nivel: Nivel): string {
  switch (nivel) {
    case "proyecto": return t.proyectoNombre;
    case "edificio": return t.edificioNombre;
    case "piso": return pisoLabel(t.pisoNumero);
    case "apto": return `Apto ${t.unidadNombre}`;
    case "espacio": return t.espacioNombre;
  }
}

export default async function ObreroTaskListPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  // Igual que el layout: por el validador, nunca por `prisma.obrero` directo.
  // Consultarlo crudo aquí se saltaba el freno y, peor, aceptaba obreros
  // inactivos o fuera de su rango de fechas que el layout ya había rechazado.
  const obrero = await validateObreroToken(token);
  if (!obrero) return null;

  const todas = await getObreroTareas(obrero.contratista_id, obrero.constructora_id);

  if (todas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-700 mb-1">No tienes tareas asignadas</h2>
        <p className="text-sm text-slate-500">Cuando tu contratista te asigne tareas, aparecerán aquí.</p>
      </div>
    );
  }

  // Filtrar por lo ya seleccionado.
  const filtradas = todas.filter((t) =>
    (!sp.proyecto || t.proyectoId === sp.proyecto) &&
    (!sp.edificio || t.edificioId === sp.edificio) &&
    (!sp.piso || String(t.pisoNumero) === sp.piso) &&
    (!sp.apto || t.unidadId === sp.apto) &&
    (!sp.espacio || t.espacioId === sp.espacio),
  );

  // Orden de dimensiones; saltamos las ya seleccionadas y las que tienen un solo
  // valor (auto-colapso: casa de 1 piso → directo a espacios; 1 apto/piso → sin apto).
  const ordenNiveles: Nivel[] = ["proyecto", "edificio", "piso", "apto", "espacio"];
  const seleccionado: Record<Nivel, string | undefined> = {
    proyecto: sp.proyecto, edificio: sp.edificio, piso: sp.piso, apto: sp.apto, espacio: sp.espacio,
  };

  let nivelActual: Nivel | null = null;
  for (const nivel of ordenNiveles) {
    if (seleccionado[nivel]) continue;
    const distintos = new Set(filtradas.map((t) => dimKey(t, nivel)));
    if (distintos.size > 1) { nivelActual = nivel; break; }
    // size <= 1 → se colapsa (no hay nada que elegir), seguimos al siguiente nivel
  }

  // Breadcrumb de lo seleccionado (en orden), con su etiqueta legible.
  const crumbs: { label: string; href: string | null }[] = [
    { label: "Inicio", href: buildHref(token, {}, {}) },
  ];
  const acumulado: SearchParams = {};
  for (const nivel of ordenNiveles) {
    const val = seleccionado[nivel];
    if (!val) continue;
    const muestra = todas.find((t) => dimKey(t, nivel) === val);
    if (!muestra) continue;
    (acumulado as Record<string, string>)[nivel] = val;
    crumbs.push({ label: dimLabel(muestra, nivel), href: buildHref(token, { ...acumulado }, {}) });
  }
  if (crumbs.length > 0) crumbs[crumbs.length - 1].href = null; // último no clickable

  const iconoNivel = {
    proyecto: FolderOpen, edificio: Building2, piso: Layers, apto: DoorOpen, espacio: Home,
  } as const;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      {crumbs.length > 1 && (
        <nav className="flex items-center gap-1 flex-wrap text-xs text-slate-500">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            const node = (
              <span className={`px-2 py-1 rounded-lg ${last ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-slate-100"}`}>
                {c.label}
              </span>
            );
            return (
              <span key={i} className="inline-flex items-center gap-1">
                {c.href ? <Link href={c.href}>{node}</Link> : node}
                {!last && <ChevronRight className="w-3 h-3 text-slate-300" />}
              </span>
            );
          })}
        </nav>
      )}

      {nivelActual ? (
        <NivelCards
          token={token}
          nivel={nivelActual}
          base={sp}
          tareas={filtradas}
          Icon={iconoNivel[nivelActual]}
        />
      ) : (
        <Tareas token={token} tareas={filtradas} />
      )}
    </div>
  );
}

// Tarjetas de un nivel (piso/espacio/apto…), con contador de tareas pendientes.
function NivelCards({
  token, nivel, base, tareas, Icon,
}: {
  token: string;
  nivel: Nivel;
  base: SearchParams;
  tareas: ObreroTarea[];
  Icon: typeof Home;
}) {
  // Agrupar por la dimensión actual, preservando orden de aparición.
  const grupos = new Map<string, { label: string; total: number; pendientes: number }>();
  for (const t of tareas) {
    const k = dimKey(t, nivel);
    if (!grupos.has(k)) grupos.set(k, { label: dimLabel(t, nivel), total: 0, pendientes: 0 });
    const g = grupos.get(k)!;
    g.total++;
    if (t.estado === "PENDIENTE" || t.estado === "NO_APROBADA") g.pendientes++;
  }

  const titulos: Record<Nivel, string> = {
    proyecto: "Elige el proyecto",
    edificio: "Elige la torre / edificio",
    piso: "Elige el piso",
    apto: "Elige el apartamento",
    espacio: "Elige el espacio",
  };

  return (
    <div>
      <h2 className="text-base font-bold text-slate-800 mb-3">{titulos[nivel]}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from(grupos.entries()).map(([k, g]) => (
          <Link
            key={k}
            href={buildHref(token, base, { [nivel]: k })}
            className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 truncate">{g.label}</p>
              <p className="text-xs text-slate-500">
                {g.pendientes > 0
                  ? `${g.pendientes} por hacer · ${g.total} en total`
                  : `${g.total} tarea${g.total === 1 ? "" : "s"} (todas al día)`}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// Hoja: las tareas del espacio elegido, separadas por estado.
function Tareas({ token, tareas }: { token: string; tareas: ObreroTarea[] }) {
  const porHacer = tareas.filter((t) => t.estado === "PENDIENTE" || t.estado === "NO_APROBADA");
  const enRevision = tareas.filter((t) => t.estado === "REPORTADA");
  const completadas = tareas.filter((t) => t.estado === "APROBADA");

  const Seccion = ({ titulo, items }: { titulo: string; items: ObreroTarea[] }) =>
    items.length === 0 ? null : (
      <section>
        <h2 className="text-base font-bold text-slate-800 mb-3">{titulo} ({items.length})</h2>
        <div className="flex flex-col gap-3">
          {items.map((t) => (
            <TareaCard key={t.id} token={token} {...t} />
          ))}
        </div>
      </section>
    );

  return (
    <div className="flex flex-col gap-6">
      <Seccion titulo="Por hacer" items={porHacer} />
      <Seccion titulo="En revisión" items={enRevision} />
      <Seccion titulo="Completadas" items={completadas} />
    </div>
  );
}
