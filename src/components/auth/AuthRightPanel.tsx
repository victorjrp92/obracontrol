"use client";

import InteractiveBuildings from "@/components/landing/InteractiveBuildings";

const stats = [
  { value: "4", label: "Vistas por rol" },
  { value: "100%", label: "Trazabilidad" },
  { value: "<2min", label: "Reportar tarea" },
];

export default function AuthRightPanel() {
  return (
    <div className="hidden lg:flex flex-1 auth-panel-dark items-center justify-center p-8 xl:p-12">
      <div className="relative z-10 text-center w-full max-w-md">
        {/* Headline */}
        <h2 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight mb-4">
          Control total de tu obra
          <br />
          desde un solo lugar
        </h2>
        <p className="text-sm xl:text-base text-white/50 leading-relaxed mb-8">
          Evidencia fotográfica, aprobaciones estructuradas y métricas en tiempo
          real para constructoras en Colombia.
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-5 xl:gap-8 mb-6">
          {stats.map((s, i) => (
            <div key={s.label} className="flex items-center gap-5 xl:gap-8">
              {i > 0 && <div className="w-px h-8 bg-white/10" />}
              <div className="text-center">
                <div className="text-lg xl:text-xl font-extrabold text-white">{s.value}</div>
                <div className="text-[10px] xl:text-xs text-white/40 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Buildings canvas — responsive height */}
        <InteractiveBuildings className="h-[250px] lg:h-[300px] xl:h-[380px] 2xl:h-[420px]" />
      </div>
    </div>
  );
}
