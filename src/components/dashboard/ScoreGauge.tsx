"use client";

interface ScoreGaugeProps {
  score: number;
  cumplimiento: number;
  calidad: number;
  velocidad: number;
  name: string;
  role?: string;
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#2563eb";
  if (score >= 55) return "#eab308";
  if (score >= 40) return "#dc2626";
  return "#7c2d12";
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function ScoreGauge({ score, cumplimiento, calidad, velocidad, name, role }: ScoreGaugeProps) {
  const color = getScoreColor(score);
  const circumference = 2 * Math.PI * 30;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-4">
        {/* SVG gauge */}
        <div className="relative flex-shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#f1f5f9" strokeWidth="6" />
            <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-extrabold text-slate-900 tabular-nums">{score}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm truncate">{name}</div>
          {role && <div className="text-xs text-slate-400 mb-2">{role}</div>}
          <div className="flex flex-col gap-1.5 mt-1">
            <ScoreBar value={cumplimiento} label="Cumplimiento 50%" color={color} />
            <ScoreBar value={calidad} label="Calidad 30%" color={color} />
            <ScoreBar value={velocidad} label="Velocidad 20%" color={color} />
          </div>
        </div>
      </div>
    </div>
  );
}
