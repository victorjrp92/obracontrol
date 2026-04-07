interface ProgressBarProps {
  label: string;
  reported: number;
  approved: number;
  semaforoColor?: string;
}

const semaforoMap: Record<string, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

export default function ProgressBar({
  label,
  reported,
  approved,
  semaforoColor = "verde",
}: ProgressBarProps) {
  const dot = semaforoMap[semaforoColor] ?? "bg-green-500";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
          <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500 tabular-nums">
          <span className="text-blue-400">{reported}%</span>
          <span className="font-semibold text-slate-800">{approved}%</span>
        </div>
      </div>

      {/* Track */}
      <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
        {/* Reported (lighter) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-300 transition-all duration-500"
          style={{ width: `${reported}%` }}
        />
        {/* Approved (darker on top) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${approved}%` }}
        />
      </div>

      <div className="flex gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-1 rounded bg-blue-300 inline-block" />
          Reportado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-1 rounded bg-blue-600 inline-block" />
          Aprobado
        </span>
      </div>
    </div>
  );
}
