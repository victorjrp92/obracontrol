"use client";

// ─────────────────────────────────────────────────────────────────────────
// Línea de tiempo de la obra con RAMAS paralelas (B2C). Mobile-first, vertical.
//
// A partir de `estimarDuracion(espacios).fases`: una línea principal de fases en
// orden constructivo; cuando dos fases corren en paralelo (oficios distintos,
// p. ej. eléctricas ∥ hidrosanitarias) la segunda cuelga como RAMA junto a la
// primera. Las esperas de secado se anotan como nota sutil ("+2 días de secado").
// NO es un Gantt: es una guía visual simple y llana para público no técnico.
// ─────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { ChevronDown, CalendarClock, GitBranch } from "lucide-react";
import { estimarDuracion, type EspacioEstim, type FaseDuracion } from "@/lib/estimar-duracion";

/** Redondeo amable a días enteros (mínimo 1) para las etiquetas. */
function dias(n: number): number {
  return Math.max(1, Math.round(n));
}

function FaseNodo({
  fase,
  esRama,
  ultimo,
}: {
  fase: FaseDuracion;
  esRama?: boolean;
  ultimo?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Riel + marcador */}
      <div className="flex flex-col items-center flex-shrink-0">
        <span
          className={`w-3 h-3 rounded-full ring-4 ${
            esRama ? "bg-violet-500 ring-violet-100" : "bg-blue-600 ring-blue-100"
          }`}
        />
        {!ultimo && <span className={`w-0.5 flex-1 ${esRama ? "bg-violet-200" : "bg-blue-200"}`} />}
      </div>
      {/* Contenido */}
      <div className={`pb-4 flex-1 min-w-0 ${esRama ? "" : ""}`}>
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="font-semibold text-slate-800 text-sm">{fase.fase}</p>
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            ~{dias(fase.dias)} {dias(fase.dias) === 1 ? "día" : "días"}
          </span>
        </div>
        {esRama && (
          <p className="text-[11px] text-violet-600 font-medium mt-0.5 inline-flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> en paralelo, sin sumar tiempo
          </p>
        )}
        {fase.esperaDias >= 1 && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            + {dias(fase.esperaDias)} {dias(fase.esperaDias) === 1 ? "día" : "días"} de secado
          </p>
        )}
      </div>
    </div>
  );
}

export default function LineaTiempoObra({
  espacios,
  areaTotal,
  colapsable = false,
  defaultAbierto = true,
  titulo = "Cómo avanzaría tu obra en el tiempo",
}: {
  espacios: EspacioEstim[];
  areaTotal?: number;
  /** Muestra encabezado plegable (para el detalle del proyecto). */
  colapsable?: boolean;
  defaultAbierto?: boolean;
  titulo?: string;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);

  const resultado = useMemo(
    () => estimarDuracion(espacios, { cuadrillas: 1, ...(areaTotal ? { areaTotal } : {}) }),
    [espacios, areaTotal],
  );

  if (resultado.fases.length === 0) return null;

  const total = resultado.totalDias;

  // Ordena las fases dibujando la primera de cada pareja paralela como carril
  // principal y la segunda como rama colgada debajo (no se cuenta doble).
  const fases = resultado.fases;
  const yaRama = new Set<string>();
  const bloques: { principal: FaseDuracion; rama?: FaseDuracion }[] = [];
  for (const f of fases) {
    if (yaRama.has(f.fase)) continue;
    const parNombre = f.enParaleloCon[0];
    const par = parNombre ? fases.find((x) => x.fase === parNombre) : undefined;
    if (par) {
      yaRama.add(par.fase);
      bloques.push({ principal: f, rama: par });
    } else {
      bloques.push({ principal: f });
    }
  }

  const cuerpo = (
    <div className="mt-1">
      <div className="rounded-xl bg-blue-50/60 border border-blue-100 px-3.5 py-2.5 mb-3 text-sm text-slate-700">
        En total, con un equipo de trabajo, esto suele tomar{" "}
        <strong className="text-slate-900">~{total.probable} días hábiles</strong>{" "}
        <span className="text-slate-500">(entre {total.min} y {total.max}).</span>
      </div>
      <div className="pl-1">
        {bloques.map((b, i) => {
          const ultimoBloque = i === bloques.length - 1;
          return (
            <div key={b.principal.fase}>
              <FaseNodo fase={b.principal} ultimo={ultimoBloque && !b.rama} />
              {b.rama && (
                <div className="ml-6 border-l-2 border-dashed border-violet-200 pl-3 -mt-2 mb-2">
                  <FaseNodo fase={b.rama} esRama ultimo />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {resultado.cobertura < 0.5 && (
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
          Es un estimado de referencia; se afina a medida que registras el avance real de la obra.
        </p>
      )}
    </div>
  );

  if (!colapsable) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" /> {titulo}
        </p>
        {cuerpo}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600" /> {titulo}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          ~{total.probable} días
          <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </span>
      </button>
      {abierto && <div className="px-4 pb-4">{cuerpo}</div>}
    </div>
  );
}
