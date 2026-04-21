"use client";

import Link from "next/link";
import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

type TaskStatus = "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA";

interface TareaRow {
  id: string;
  nombre: string;
  contratista: string | null;
  diasEstimados: number;
  plazo: number;
  estado: TaskStatus;
  faseNombre: string;
  faseOrden: number;
}

interface TareasTableProps {
  tareas: TareaRow[];
}

const statusConfig: Record<
  TaskStatus,
  { icon: React.ReactNode; label: string; class: string }
> = {
  PENDIENTE: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "Pendiente",
    class: "text-slate-500 bg-slate-50 border-slate-200",
  },
  REPORTADA: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: "Reportada",
    class: "text-blue-600 bg-blue-50 border-blue-200",
  },
  APROBADA: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "Aprobada",
    class: "text-green-600 bg-green-50 border-green-200",
  },
  NO_APROBADA: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: "No aprobada",
    class: "text-red-600 bg-red-50 border-red-200",
  },
};

function PlazoCell({ plazo, estado }: { plazo: number; estado: TaskStatus }) {
  if (estado === "APROBADA") {
    return <span className="text-green-600 text-sm">Completada</span>;
  }
  if (plazo > 0) {
    return <span className="text-slate-500 text-sm tabular-nums">{plazo} {plazo === 1 ? "Día" : "Días"}</span>;
  }
  if (plazo === 0) {
    return <span className="text-yellow-600 text-sm font-medium">Vence hoy</span>;
  }
  return (
    <span className="text-red-500 text-sm font-medium tabular-nums">
      {Math.abs(plazo)} {Math.abs(plazo) === 1 ? "Día" : "Días"} atraso
    </span>
  );
}

function StatusBadge({ estado }: { estado: TaskStatus }) {
  const st = statusConfig[estado];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.class}`}
    >
      {st.icon}
      {st.label}
    </span>
  );
}

/** Group tareas by phase, preserving the order from the data (already sorted by faseOrden) */
function groupByPhase(tareas: TareaRow[]) {
  const groups: { faseNombre: string; faseOrden: number; tareas: TareaRow[] }[] = [];
  const seen = new Map<string, number>();

  for (const t of tareas) {
    const key = `${t.faseOrden}::${t.faseNombre}`;
    if (seen.has(key)) {
      groups[seen.get(key)!].tareas.push(t);
    } else {
      seen.set(key, groups.length);
      groups.push({ faseNombre: t.faseNombre, faseOrden: t.faseOrden, tareas: [t] });
    }
  }

  return groups;
}

export default function TareasTable({ tareas }: TareasTableProps) {
  const groups = groupByPhase(tareas);

  if (tareas.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No hay tareas con este estado
      </div>
    );
  }

  return (
    <>
      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Tarea
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Contratista
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                Dias est.
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                Plazo
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                Estatus
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <PhaseGroup key={group.faseNombre} group={group} />
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards (below md) ── */}
      <div className="md:hidden space-y-1">
        {groups.map((group) => (
          <div key={group.faseNombre}>
            {/* Phase divider */}
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">
                {group.faseNombre}
              </span>
              <span className="ml-2 text-xs text-slate-400">
                ({group.tareas.length} tarea{group.tareas.length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="divide-y divide-slate-50">
              {group.tareas.map((t) => (
                <MobileCard key={t.id} tarea={t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PhaseGroup({
  group,
}: {
  group: { faseNombre: string; faseOrden: number; tareas: TareaRow[] };
}) {
  return (
    <>
      {/* Phase header row */}
      <tr>
        <td
          colSpan={5}
          className="bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100"
        >
          {group.faseNombre}{" "}
          <span className="font-normal text-slate-400">
            ({group.tareas.length} tarea{group.tareas.length !== 1 ? "s" : ""})
          </span>
        </td>
      </tr>
      {/* Task rows */}
      {group.tareas.map((t) => (
        <tr
          key={t.id}
          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
        >
          <td className="px-4 py-2.5">
            <Link
              href={`/dashboard/tareas/${t.id}`}
              className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors"
            >
              {t.nombre}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-sm text-slate-500">
            {t.contratista ?? "—"}
          </td>
          <td className="px-4 py-2.5 text-right">
            <span className="text-sm text-slate-600 tabular-nums">
              {t.diasEstimados} Días
            </span>
          </td>
          <td className="px-4 py-2.5 text-right">
            <PlazoCell plazo={t.plazo} estado={t.estado} />
          </td>
          <td className="px-4 py-2.5 text-right">
            <StatusBadge estado={t.estado} />
          </td>
        </tr>
      ))}
    </>
  );
}

function MobileCard({ tarea: t }: { tarea: TareaRow }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 mx-2 my-1.5">
      <Link
        href={`/dashboard/tareas/${t.id}`}
        className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors"
      >
        {t.nombre}
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="text-slate-500">{t.contratista ?? "—"}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-600 tabular-nums">{t.diasEstimados} Días est.</span>
        <span className="text-slate-400">·</span>
        <PlazoCell plazo={t.plazo} estado={t.estado} />
        <span className="text-slate-400">·</span>
        <StatusBadge estado={t.estado} />
      </div>
    </div>
  );
}
