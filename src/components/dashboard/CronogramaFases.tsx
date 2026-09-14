"use client";

// ─────────────────────────────────────────────────────────────────────────
// EL CRONOGRAMA FUSIONADO CON EL AVANCE, dentro de Reportes.
//
// Los tres cuadros de arriba son el estándar de cualquier informe de
// interventoría colombiano, y van juntos porque separados engañan:
//
//   · % TIEMPO TRANSCURRIDO — cuánto del plazo se gastó.
//   · % AVANCE EJECUTADO    — cuánto se hizo de verdad.
//   · % AVANCE PROGRAMADO   — cuánto tocaba llevar hoy.
//
// Un 49% solo no dice nada: contra un 44% programado es una obra sana, contra
// un 70% es una obra hundida. El cociente de los dos últimos es el SPI, y es
// la única cifra de esta pantalla que se puede pegar en un acta.
//
// ══ EL TERCER CUADRO PUEDE NO EXISTIR, Y ESO SE DICE ═══════════════════════
//
// Sin cronograma cargado no hay programado ni SPI. Eso NO se pinta como un
// cero —un cero dice «hoy no tocaba nada»— ni como un guion mudo, que parece
// que la app se rompió. Se dice qué falta y dónde cargarlo. Hoy es el caso de
// TODAS las obras que ya existen.
//
// ══ POR QUÉ LA BARRA SE DESPLIEGA ══════════════════════════════════════════
//
// Diez fases abiertas empujan las gráficas de velocidad por debajo del
// pliegue. Cerrada, la barra sigue diciendo lo que importa —cuántas fases van
// atrasadas—; si eso ya contesta la pregunta, no hace falta abrir. Mismo
// patrón colapsable que `AvanceFases`, a propósito.
//
// Todo llega ya calculado y en ISO desde `data-cronograma.ts`: aquí solo se
// pinta. La aritmética vive en `avance-programado.ts`, que es puro y tiene su
// propia verificación.
// ─────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { CalendarRange, ChevronDown, GanttChartSquare, Info } from "lucide-react";
import {
  formatearMiles,
  formatearPorcentaje,
  formatearPuntos,
  formatearSPI,
  type EstadoFase,
} from "@/lib/avance-programado";
import type { FaseCronograma, MotivoSinCronograma, ResumenCronograma } from "@/lib/data-cronograma";

/** Ancho mínimo de una banda: una fase de tres días en una obra de año y medio
 *  es 0,5% del track y desaparecería. Que exista importa más que su tamaño. */
const ANCHO_MINIMO = 1.5;

const ESTADO_UI: Record<EstadoFase, { texto: string; chip: string; barra: string }> = {
  CERRADA: { texto: "cerrada", chip: "bg-green-50 text-green-700 border-green-100", barra: "bg-green-500" },
  EN_CURSO: { texto: "en curso", chip: "bg-blue-50 text-blue-700 border-blue-100", barra: "bg-blue-600" },
  ATRASADA: { texto: "atrasada", chip: "bg-red-50 text-red-700 border-red-100", barra: "bg-red-500" },
  SIN_EMPEZAR: { texto: "sin empezar", chip: "bg-slate-50 text-slate-500 border-slate-200", barra: "bg-slate-400" },
  SIN_MEDIDA: { texto: "sin plan", chip: "bg-amber-50 text-amber-700 border-amber-100", barra: "bg-slate-400" },
};

const RITMO_UI = {
  ADELANTADA: { texto: "obra adelantada", chip: "bg-green-50 text-green-700 border-green-200" },
  EN_PLAZO: { texto: "obra en plazo", chip: "bg-blue-50 text-blue-700 border-blue-200" },
  ATRASADA: { texto: "obra atrasada", chip: "bg-red-50 text-red-700 border-red-200" },
} as const;

/** Qué falta, en la lengua del usuario. Lo genérico («no hay datos») no sirve:
 *  el que lee tiene que saber qué pantalla abrir para arreglarlo. */
function textoFaltante(motivo: MotivoSinCronograma, r: ResumenCronograma): string {
  switch (motivo) {
    case "SIN_FASES":
      return "Esta obra no tiene fases cargadas, así que no hay cronograma que medir.";
    case "SIN_VENTANAS_FASE":
      return `Ninguna de las ${r.fases.length} fases tiene fechas planeadas de inicio y fin. Cárgalas en el cronograma de la obra y el informe podrá decir cuánto tocaba llevar hoy.`;
    case "CRONOGRAMA_PARCIAL":
      return `${r.cobertura.fasesSinVentana} de ${r.fases.length} fases no tienen fechas planeadas: el programado se calcula solo sobre las ${formatearMiles(r.cobertura.tareasConVentana)} tareas que sí están en el cronograma.`;
    case "SIN_FECHAS_OBRA":
      return "La obra no tiene fecha de inicio y fecha de fin estimada, que es lo que mide el tiempo transcurrido.";
    case "ESQUEMA_PENDIENTE":
      return "Las columnas del cronograma todavía no existen en esta base de datos: falta aplicar la migración del cronograma planeado.";
  }
}

/** Posición 0–100 de una fecha dentro del track. */
function posicion(t: number, t0: number, t1: number): number {
  return ((t - t0) / (t1 - t0)) * 100;
}

export default function CronogramaFases({ resumen }: { resumen: ResumenCronograma }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);

  // Los extremos del track: la ventana de la obra más la de todas las fases,
  // porque una fase puede salirse del plazo declarado y hay que verla salirse.
  const escala = useMemo(() => {
    const puntos: number[] = [];
    for (const iso of [resumen.inicioObra, resumen.finObra]) {
      if (iso) puntos.push(Date.parse(iso));
    }
    for (const f of resumen.fases) {
      if (f.inicioPlan) puntos.push(Date.parse(f.inicioPlan));
      if (f.finPlan) puntos.push(Date.parse(f.finPlan));
    }
    const validos = puntos.filter((p) => Number.isFinite(p));
    if (validos.length < 2) return null;
    const t0 = Math.min(...validos);
    const t1 = Math.max(...validos);
    if (t1 <= t0) return null;
    return { t0, t1, hoy: Date.parse(resumen.hoy) };
  }, [resumen]);

  const hayCronograma = resumen.programado !== null;
  const atrasadas = resumen.fases.filter((f) => f.estado === "ATRASADA").length;
  const ritmo = resumen.ritmo ? RITMO_UI[resumen.ritmo] : null;

  const cuadros = [
    {
      clave: "tiempo",
      label: "Tiempo transcurrido",
      valor: resumen.tiempo ? formatearPorcentaje(resumen.tiempo.fraccion) : "Sin plazo",
      disponible: resumen.tiempo !== null,
      sub: resumen.tiempo
        ? `día ${formatearMiles(resumen.tiempo.diasCorridos)} de ${formatearMiles(resumen.tiempo.plazoDias)} · ${resumen.plazoTexto}`
        : "falta la fecha de inicio o de fin de la obra",
    },
    {
      clave: "ejecutado",
      label: "Avance ejecutado",
      valor: resumen.ejecutado !== null ? formatearPorcentaje(resumen.ejecutado) : "Sin tareas",
      disponible: resumen.ejecutado !== null,
      // El desglose es el que cuadra esta pantalla con el resto de la app: allá
      // se enseña solo lo aprobado, aquí lo aprobado más el 80% de lo reportado.
      sub:
        resumen.ejecutado !== null && resumen.aprobado !== null
          ? `${formatearPorcentaje(resumen.aprobado)} aprobado · ${formatearMiles(resumen.conteos.reportadas)} esperando revisión`
          : "esta obra no tiene tareas",
    },
    {
      clave: "programado",
      label: "Avance programado",
      valor: hayCronograma ? formatearPorcentaje(resumen.programado!) : "Sin cronograma",
      disponible: hayCronograma,
      sub: hayCronograma
        ? `lo que tocaba llevar hoy según el cronograma`
        : "no se puede calcular: falta cargar el cronograma",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden mb-6">
      <div className="px-5 sm:px-6 pt-5">
        <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <GanttChartSquare className="w-4 h-4 text-blue-600" /> Avance contra cronograma
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">{resumen.proyectoNombre}</p>

        {/* ── El trío, siempre a la vista ───────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {cuadros.map((c) => (
            <div key={c.clave} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-medium text-slate-500 mb-1">{c.label}</p>
              <div
                className={
                  c.disponible
                    ? "text-2xl font-extrabold text-slate-900 tabular-nums"
                    : "text-base font-bold text-slate-400"
                }
              >
                {c.valor}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* ── SPI ───────────────────────────────────────────────────────── */}
        {resumen.spi !== null && ritmo ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold ${ritmo.chip}`}
            >
              SPI {formatearSPI(resumen.spi)} · {ritmo.texto}
            </span>
            <span>
              avance ejecutado ÷ avance programado. Por encima de 1,00 la obra va adelantada.
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold">
                No se puede calcular el avance programado ni el SPI.
              </strong>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {resumen.faltantes
                  .filter((m) => m !== "CRONOGRAMA_PARCIAL")
                  .map((m) => (
                    <li key={m}>{textoFaltante(m, resumen)}</li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        {/* Cronograma a medias: hay SPI, pero no cubre toda la obra. Decirlo es
            obligatorio — comparar un programado de 9 fases contra un ejecutado
            de 10 es justo el número que nadie debería firmar. */}
        {hayCronograma && resumen.faltantes.includes("CRONOGRAMA_PARCIAL") && (
          <p className="mt-2 text-[11px] text-amber-700">
            {textoFaltante("CRONOGRAMA_PARCIAL", resumen)}
          </p>
        )}
      </div>

      {/* ── La barra que despliega el cronograma ────────────────────────── */}
      {resumen.fases.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="mt-4 w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 text-left cursor-pointer border-t border-slate-100 hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
              <CalendarRange className="w-4 h-4 text-blue-600 flex-shrink-0" />
              Cronograma fase por fase
              <span className="font-medium text-slate-400 truncate">
                {resumen.fases.length} fases
              </span>
            </span>
            <span className="flex items-center gap-3 text-xs whitespace-nowrap">
              {atrasadas > 0 && (
                <span className="text-red-600 font-semibold">
                  {atrasadas} {atrasadas === 1 ? "atrasada" : "atrasadas"}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
              />
            </span>
          </button>

          {abierto && (
            <div className="px-5 sm:px-6 pb-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <i className="w-3.5 h-2 rounded-sm bg-slate-200" /> Ventana planeada
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-3.5 h-2 rounded-sm bg-blue-600" /> Ejecutado
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-px h-3 bg-red-500" /> Hoy
                </span>
              </div>

              <ul className="flex flex-col gap-1">
                {resumen.fases.map((f) => (
                  <li
                    key={f.id}
                    className={`rounded-xl border bg-white overflow-hidden transition-colors ${
                      f.estado === "ATRASADA"
                        ? "border-red-100 ring-2 ring-red-50"
                        : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDetalle(detalle === f.id ? null : f.id)}
                      aria-expanded={detalle === f.id}
                      className="w-full grid grid-cols-[26px_minmax(0,1.4fr)_minmax(0,2fr)_auto_16px] gap-2 sm:gap-4 items-center px-3 sm:px-4 py-3 text-left cursor-pointer"
                    >
                      <span className="w-[26px] h-[26px] rounded-lg grid place-items-center text-[11px] font-extrabold bg-slate-50 text-slate-500 border border-slate-100">
                        {f.orden}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 truncate">
                          {f.nombre}
                        </span>
                        <span className="block text-[11px] font-semibold text-slate-400 truncate mt-0.5">
                          {f.ventanaTexto ?? "sin ventana planeada"}
                        </span>
                      </span>

                      {/* El track: banda gris de lo planeado, barra de color del
                          ejecutado encima, y la línea de hoy cruzándolo todo. */}
                      <span className="relative block h-6 rounded-md bg-slate-50 border border-slate-100 overflow-hidden">
                        {escala &&
                          (() => {
                            const i = f.inicioPlan ? Date.parse(f.inicioPlan) : null;
                            const fin = f.finPlan ? Date.parse(f.finPlan) : null;
                            if (i === null || fin === null) return null;
                            const izq = posicion(i, escala.t0, escala.t1);
                            const ancho = Math.max(
                              ANCHO_MINIMO,
                              posicion(fin, escala.t0, escala.t1) - izq,
                            );
                            const ejecutado = f.ejecutado ?? 0;
                            return (
                              <>
                                <i
                                  className="absolute top-0 bottom-0 bg-slate-200"
                                  style={{ left: `${izq}%`, width: `${ancho}%` }}
                                />
                                {ejecutado > 0 && (
                                  <i
                                    className={`absolute top-1 bottom-1 rounded-sm ${ESTADO_UI[f.estado].barra}`}
                                    style={{ left: `${izq}%`, width: `${ancho * ejecutado}%` }}
                                  />
                                )}
                              </>
                            );
                          })()}
                        {escala &&
                          escala.hoy >= escala.t0 &&
                          escala.hoy <= escala.t1 && (
                            <i
                              className="absolute top-0 bottom-0 w-px bg-red-500"
                              style={{ left: `${posicion(escala.hoy, escala.t0, escala.t1)}%` }}
                            />
                          )}
                      </span>

                      <span className="flex items-center gap-2 justify-end">
                        <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                          {f.ejecutado !== null ? formatearPorcentaje(f.ejecutado) : "—"}
                        </span>
                        <span
                          className={`hidden sm:inline text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ESTADO_UI[f.estado].chip}`}
                        >
                          {ESTADO_UI[f.estado].texto}
                        </span>
                      </span>

                      <ChevronDown
                        className={`w-4 h-4 text-slate-300 transition-transform ${detalle === f.id ? "rotate-180" : ""}`}
                      />
                    </button>

                    {detalle === f.id && <DetalleFilas fase={f} />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Las cifras de una fase abierta. Es una tabla de datos, no un componente con
 *  vida propia: vive aquí porque fuera de esta fila no significa nada. */
function DetalleFilas({ fase }: { fase: FaseCronograma }) {
  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Ventana planeada", valor: fase.ventanaTexto ?? "sin cargar" },
    {
      etiqueta: "Ejecutado",
      valor: fase.ejecutado !== null ? formatearPorcentaje(fase.ejecutado) : "sin tareas",
    },
    {
      etiqueta: "Programado a la fecha",
      valor: fase.programado !== null ? formatearPorcentaje(fase.programado) : "sin cronograma",
    },
    {
      etiqueta: "Diferencia",
      valor: fase.diferencia !== null ? formatearPuntos(fase.diferencia) : "no se puede calcular",
    },
    { etiqueta: "Aprobadas", valor: `${formatearMiles(fase.conteos.aprobadas)} de ${formatearMiles(fase.total)}` },
    { etiqueta: "Esperando revisión", valor: formatearMiles(fase.conteos.reportadas) },
    { etiqueta: "Devueltas", valor: formatearMiles(fase.conteos.devueltas) },
    { etiqueta: "Sin empezar", valor: formatearMiles(fase.conteos.pendientes) },
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 px-3 sm:px-4 pb-4 pt-1 border-t border-slate-50">
      {filas.map((f) => (
        <div key={f.etiqueta}>
          <dt className="text-[11px] font-semibold text-slate-400">{f.etiqueta}</dt>
          <dd className="text-sm font-bold text-slate-800 tabular-nums">{f.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
