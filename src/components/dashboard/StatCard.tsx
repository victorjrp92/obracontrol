import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  sub?: string;
}

export default function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  trend,
  trendUp,
  sub,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
          <div className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</div>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span
            className={`text-xs font-semibold ${trendUp ? "text-green-600" : "text-red-500"}`}
          >
            {trend}
          </span>
        </div>
      )}
    </div>
  );
}
