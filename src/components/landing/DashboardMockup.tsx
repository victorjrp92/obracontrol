"use client";

import { CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

const tasks = [
  { name: "Estuco cocina · Apto 401", status: "aprobada", progress: 100, time: "verde-intenso" },
  { name: "Pintura sala · Apto 402", status: "reportada", progress: 65, time: "verde" },
  { name: "Mueble bajo cocina · Apto 403", status: "pendiente", progress: 30, time: "amarillo" },
  { name: "Panel yeso baño · Apto 404", status: "no_aprobada", progress: 50, time: "rojo" },
];

const statusConfig = {
  aprobada: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: "Aprobada",
    color: "text-green-600 bg-green-50",
  },
  reportada: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: "Reportada",
    color: "text-blue-600 bg-blue-50",
  },
  pendiente: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: "Pendiente",
    color: "text-yellow-600 bg-yellow-50",
  },
  no_aprobada: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: "No aprobada",
    color: "text-red-600 bg-red-50",
  },
};

const timeColors: Record<string, string> = {
  "verde-intenso": "bg-green-700",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

const progressColors: Record<string, string> = {
  "verde-intenso": "bg-green-600",
  verde: "bg-blue-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
  vinotinto: "bg-red-900",
};

export default function DashboardMockup() {
  return (
    <div className="relative">
      {/* Glow behind */}
      <div className="absolute inset-4 bg-blue-500/20 blur-2xl rounded-3xl" />

      {/* Main mockup window */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl bg-white">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-900 border-b border-slate-700">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="ml-auto text-slate-400 text-xs font-mono">seiricon.co/proyecto/olivo</div>
        </div>

        {/* App content */}
        <div className="bg-slate-50 p-4 flex gap-3">
          {/* Sidebar mini */}
          <div className="w-10 flex flex-col items-center gap-3 py-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-7 h-7 rounded-lg ${i === 0 ? "bg-blue-600" : "bg-slate-200"}`}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Proyecto Olivo · Torre 5</div>
                <div className="text-xs text-slate-500">Piso 4 · Fase Madera</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-slate-600">En vivo</span>
              </div>
            </div>

            {/* Progress summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Progreso aprobado</div>
                <div className="text-xl font-bold text-slate-900">62%</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-[62%] rounded-full bg-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-100">
                <div className="text-xs text-slate-500 mb-1">Reportado</div>
                <div className="text-xl font-bold text-slate-900">78%</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full w-[78%] rounded-full bg-blue-300" />
                </div>
              </div>
            </div>

            {/* Task list */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
                Tareas activas
              </div>
              {tasks.map((task, i) => {
                const st = statusConfig[task.status as keyof typeof statusConfig];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Semáforo dot */}
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${timeColors[task.time]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-700 truncate">{task.name}</div>
                      <div className="mt-0.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progressColors[task.time]} transition-all`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${st.color}`}
                    >
                      {st.icon}
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating notification card */}
      <div className="absolute -right-6 top-10 glass-card rounded-xl p-3 shadow-lg border border-blue-100 w-52">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-800">Tarea aprobada</div>
            <div className="text-[10px] text-slate-500">Closet tipo 1 · Apto 302</div>
            <div className="text-[10px] text-blue-500 mt-0.5">hace 2 min</div>
          </div>
        </div>
      </div>

      {/* Floating score card */}
      <div className="absolute -left-6 bottom-12 glass-card rounded-xl p-3 shadow-lg border border-orange-100 w-44">
        <div className="text-[11px] text-slate-500 mb-1">Score contratista</div>
        <div className="flex items-end gap-1">
          <span className="text-2xl font-extrabold text-slate-900">87</span>
          <span className="text-xs text-green-600 font-semibold mb-0.5">+3 ↑</span>
        </div>
        <div className="mt-2 flex gap-1">
          {[5, 4, 5, 3, 5, 4, 5].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-blue-500 opacity-70"
              style={{ height: `${h * 4}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
