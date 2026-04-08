import Link from "next/link";
import { CheckCircle2, Clock, AlertTriangle, XCircle, ChevronRight } from "lucide-react";

type TaskStatus = "PENDIENTE" | "REPORTADA" | "APROBADA" | "NO_APROBADA";
type SemaforoLevel = "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto";

interface TaskRowProps {
  id?: string;
  name: string;
  project: string;
  unit: string;
  status: TaskStatus;
  semaforo: SemaforoLevel;
  daysLeft?: number;
  contractor?: string;
}

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; class: string }> = {
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

const semaforoColors: Record<SemaforoLevel, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

export default function TaskRow({
  id,
  name,
  project,
  unit,
  status,
  semaforo,
  daysLeft,
  contractor,
}: TaskRowProps) {
  const st = statusConfig[status];
  const dot = semaforoColors[semaforo];

  const content = (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-slate-50/80 transition-colors cursor-pointer rounded-lg group">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate">
          {project} · {unit}
          {contractor && ` · ${contractor}`}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {daysLeft !== undefined && (
          <span
            className={`text-xs tabular-nums font-medium ${
              daysLeft < 0 ? "text-red-500" : daysLeft === 0 ? "text-yellow-500" : "text-slate-500"
            }`}
          >
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d atraso` : daysLeft === 0 ? "Vence hoy" : `${daysLeft}d`}
          </span>
        )}

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${st.class}`}
        >
          {st.icon}
          {st.label}
        </span>

        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
    </div>
  );

  if (id) {
    return <Link href={`/dashboard/tareas/${id}`}>{content}</Link>;
  }
  return content;
}
