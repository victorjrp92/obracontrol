"use client";

// ─────────────────────────────────────────────────────────────────────────
// Contra-pronóstico (B2C): SOLO GUÍA, nunca bloquea. Tono cálido y llano:
// nada de jerga ("cuadrilla", "imprevistos") — hablamos de "un equipo de
// trabajo".
//
// ══ QUÉ CAMBIÓ, Y POR QUÉ IMPORTA ══════════════════════════════════════════
//
// Antes decía «usualmente toma ~62 días hábiles (entre 37 y 85)». Tres
// problemas, los tres del mismo tamaño:
//
//  1. «62 días hábiles» obliga al usuario a hacer una conversión que no sabe
//     hacer. Cuenta 62 en el calendario del teléfono, cae dos semanas antes, y
//     la app queda mintiendo sin haberse equivocado. Ahora se enseña una
//     FECHA, y una fecha no admite dos lecturas.
//  2. «entre 37 y 85» no eran percentiles de nada: eran dos escenarios que
//     suponían que TODAS las tareas van mal a la vez. Un ±37% que no se puede
//     interpretar no es información, es ruido con formato.
//  3. Y sobre todo: no había forma de responder la única pregunta que el
//     usuario tiene de verdad — «¿llego a mi fecha?». Ahora sí:
//     `probabilidadFecha` la responde en «X de cada 10 obras parecidas».
// ─────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { CalendarClock, Info } from "lucide-react";
import {
  addWorkingDays,
  DIAS_HABILES_SEMANA_DEFECTO,
} from "@/lib/calendario-colombia";
import {
  estimarDuracion,
  fechaLarga,
  fechaUTCDesde,
  probabilidadHasta,
  pronosticoFechas,
  type EspacioEstim,
} from "@/lib/estimar-duracion";

export default function ContraPronostico({
  espacios,
  plazoDias,
  areaTotal,
  fechaInicio,
  fechaFin,
  diasHabilesSemana = DIAS_HABILES_SEMANA_DEFECTO,
}: {
  espacios: EspacioEstim[];
  /** Días hábiles del plan del usuario (fechas), o null si no dio fechas. */
  plazoDias: number | null;
  areaTotal?: number;
  /** Arranque de la obra. Sin él se ancla en hoy («si arrancas hoy…»). */
  fechaInicio?: string | Date | null;
  /** Fecha de entrega que puso el usuario, si la puso. */
  fechaFin?: string | Date | null;
  diasHabilesSemana?: number;
}) {
  // `diasHabilesSemana` entra TAMBIÉN en el motor, no solo en el calendario: es
  // el ρ que traduce las esperas de secado de días calendario a días de obra.
  // Pasárselo solo a `pronosticoFechas` dejaba la duración calculada con la
  // jornada por defecto (6) y las fechas con la real — dos números que no
  // cuadran entre sí en cuanto el proyecto no trabaja Lu–Sá.
  const est = useMemo(
    () =>
      estimarDuracion(espacios, {
        cuadrillas: 1,
        diasHabilesSemana,
        ...(areaTotal ? { areaTotal } : {}),
      }),
    [espacios, areaTotal, diasHabilesSemana],
  );
  // Si el usuario todavía no puso fecha de arranque, se ancla en HOY y el copy
  // lo dice. Se congela al montar para que el componente no cambie de fecha a
  // media sesión.
  const [hoy] = useState(() => new Date());
  const inicio = fechaUTCDesde(fechaInicio) ?? fechaUTCDesde(hoy)!;
  const arrancaHoy = fechaUTCDesde(fechaInicio) === null;

  // Sin tareas suficientes para estimar → no mostramos nada.
  if (est.fases.length === 0 || est.probabilidad.p50 <= 0) return null;

  const dist = est.probabilidad;
  const pron = pronosticoFechas(dist, { inicio, diasHabilesSemana });
  const fechaP50 = fechaLarga(pron.fechaP50, inicio);
  const fechaP80 = fechaLarga(pron.fechaP80, inicio);
  const prefijo = arrancaHoy ? "Si arrancas hoy, lo" : "Lo";

  // Sin fecha de entrega: se ofrece la fecha como referencia (no se impone).
  if (plazoDias == null && !fechaFin) {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0 text-sm text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800">Tiempo estimado</p>
          <p className="mt-0.5">
            {prefijo} más probable es que termines el{" "}
            <strong className="text-slate-900">{fechaP50}</strong>. En 8 de cada 10 obras
            parecidas, se termina antes del{" "}
            <strong className="text-slate-900">{fechaP80}</strong>.
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Te sirve como referencia si aún no tienes fecha de entrega.
          </p>
        </div>
      </div>
    );
  }

  // Con fecha de entrega: la pregunta de verdad es «¿llego?». Se responde con
  // la probabilidad de ESA fecha, no con una banda que no significa nada.
  const meta =
    fechaUTCDesde(fechaFin) ??
    addWorkingDays(inicio, Math.max(1, plazoDias ?? 1), diasHabilesSemana);
  const probabilidad = fechaUTCDesde(fechaFin)
    ? pron.probabilidadFecha(meta)
    : probabilidadHasta(dist, plazoDias ?? 0);
  const deCada10 = Math.round(probabilidad * 10);

  type Banda = "apretado" | "realista" | "holgado";
  const banda: Banda = deCada10 <= 3 ? "apretado" : deCada10 >= 9 ? "holgado" : "realista";
  const estilos: Record<Banda, { wrap: string; icon: string }> = {
    apretado: { wrap: "border-amber-200 bg-amber-50/80", icon: "bg-amber-100 text-amber-600" },
    realista: { wrap: "border-blue-100 bg-blue-50/70", icon: "bg-blue-100 text-blue-600" },
    holgado: {
      wrap: "border-emerald-200 bg-emerald-50/70",
      icon: "bg-emerald-100 text-emerald-600",
    },
  };
  const cierre: Record<Banda, string> = {
    apretado:
      "Se puede lograr, pero conviene revisar que tengas el equipo suficiente o dejar un margen. Es solo una guía, no un límite.",
    realista: "Vas bien: tu fecha encaja con lo que suele tomar una obra así.",
    holgado: "Tienes margen de sobra, ideal para trabajar sin apuros.",
  };
  const st = estilos[banda];
  const cuantas =
    deCada10 <= 0
      ? "casi ninguna vez"
      : deCada10 >= 10
        ? "casi siempre"
        : `${deCada10} de cada 10 veces`;

  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${st.wrap}`}>
      <span
        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${st.icon}`}
      >
        <Info className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0 text-sm text-slate-700 leading-relaxed">
        <p className="font-semibold text-slate-800">Sobre tus fechas</p>
        <p className="mt-0.5">
          Tu entrega es el <strong className="text-slate-900">{fechaLarga(meta, inicio)}</strong>.
          Con un equipo de trabajo, una obra así se termina a tiempo{" "}
          <strong className="text-slate-900">{cuantas}</strong>.
        </p>
        <p className="mt-1">
          {prefijo} más probable es que termines el{" "}
          <strong className="text-slate-900">{fechaP50}</strong>; en 8 de cada 10 obras
          parecidas, antes del <strong className="text-slate-900">{fechaP80}</strong>.
        </p>
        <p className="text-xs text-slate-500 mt-1.5">{cierre[banda]}</p>
      </div>
    </div>
  );
}
