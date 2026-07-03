"use client";

// ─────────────────────────────────────────────────────────────────────────
// Contra-pronóstico (B2C): SOLO GUÍA, nunca bloquea. Compara la duración del
// PLAN del usuario (días hábiles entre sus fechas) contra la duración USUAL
// estimada por el motor determinista (`estimarDuracion`). Tono cálido y llano:
// nada de jerga ("cuadrilla", "imprevistos") — hablamos de "un equipo de trabajo".
// ─────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { CalendarClock, Info } from "lucide-react";
import { estimarDuracion, type EspacioEstim } from "@/lib/estimar-duracion";

export default function ContraPronostico({
  espacios,
  plazoDias,
  areaTotal,
}: {
  espacios: EspacioEstim[];
  /** Días hábiles del plan del usuario (fechas), o null si no dio fechas. */
  plazoDias: number | null;
  areaTotal?: number;
}) {
  const est = useMemo(
    () => estimarDuracion(espacios, { cuadrillas: 1, ...(areaTotal ? { areaTotal } : {}) }),
    [espacios, areaTotal],
  );

  // Sin tareas suficientes para estimar → no mostramos nada.
  if (est.fases.length === 0 || est.totalDias.probable <= 0) return null;

  const { probable, min, max } = est.totalDias;

  // Sin fechas: ofrecemos el estimado como referencia (no imponemos).
  if (plazoDias == null) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 text-sm text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800">Tiempo estimado</p>
          <p className="mt-0.5">
            Para lo que planeas, con un equipo de trabajo usualmente toma{" "}
            <strong className="text-slate-900">~{probable} días hábiles</strong>{" "}
            <span className="text-slate-500">(entre {min} y {max})</span>. Te sirve como
            referencia si aún no tienes fecha de fin.
          </p>
        </div>
      </div>
    );
  }

  // Con fechas: comparamos plan vs. usual. Tres bandas.
  type Banda = "corto" | "normal" | "holgado";
  const banda: Banda = plazoDias < min ? "corto" : plazoDias > max ? "holgado" : "normal";

  const estilos: Record<Banda, { wrap: string; icon: string }> = {
    corto: { wrap: "border-amber-200 bg-amber-50/80", icon: "bg-amber-100 text-amber-600" },
    normal: { wrap: "border-blue-100 bg-blue-50/70", icon: "bg-blue-100 text-blue-600" },
    holgado: { wrap: "border-emerald-200 bg-emerald-50/70", icon: "bg-emerald-100 text-emerald-600" },
  };
  const veredicto: Record<Banda, string> = {
    corto: "es más corto de lo usual",
    normal: "está dentro de lo normal",
    holgado: "es holgado",
  };
  const cierre: Record<Banda, string> = {
    corto:
      "Se puede lograr, pero conviene revisar que tengas el equipo suficiente o dejar un margen. Es solo una guía, no un límite.",
    normal: "Vas bien: tu plan encaja con lo que suele tomar una obra así.",
    holgado: "Tienes margen de sobra, ideal para trabajar sin apuros.",
  };
  const st = estilos[banda];

  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${st.wrap}`}>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${st.icon}`}>
        <Info className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0 text-sm text-slate-700 leading-relaxed">
        <p className="font-semibold text-slate-800">Sobre tus fechas</p>
        <p className="mt-0.5">
          Para lo que planeas, con un equipo de trabajo usualmente toma{" "}
          <strong className="text-slate-900">~{probable} días hábiles</strong>{" "}
          <span className="text-slate-500">(entre {min} y {max})</span>. Tu plan de{" "}
          <strong className="text-slate-900">{plazoDias} días</strong> {veredicto[banda]}.
        </p>
        <p className="text-xs text-slate-500 mt-1.5">{cierre[banda]}</p>
      </div>
    </div>
  );
}
