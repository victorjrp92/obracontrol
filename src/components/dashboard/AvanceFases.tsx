"use client";

// ─────────────────────────────────────────────────────────────────────────
// Las FASES de la obra, con su avance.
//
// Sustituye a una línea de texto —«Fases: Obra gris, Mampostería, …»— que con
// diez fases y miles de tareas repartidas entre ellas solo decía que existían.
//
// Cada fila trae su barra de cuatro tramos, y la barra es el argumento: el
// azul oscuro es trabajo APROBADO y el claro es trabajo HECHO QUE NADIE HA
// REVISADO. Esa franja clara es plata parada —el contratista no cobra hasta
// que se apruebe— y hoy no se ve en ninguna pantalla.
//
// La fila se abre porque el porcentaje de una fase es un promedio sobre
// torres que van en frentes distintos, y ese promedio no describe a ninguna:
// «Enchapes y pisos» al 49% resultó ser torre 1 al 100%, torre 2 al 46% y
// torre 3 sin empezar. El promedio ordena la lista; la verdad está adentro.
//
// Y la SECCIÓN ENTERA colapsa, cerrada por defecto: diez filas abiertas se
// comen la pantalla y empujan las torres —que son lo que el usuario vino a
// ver— por debajo del pliegue. Cerrada tiene que seguir diciendo algo, así
// que el encabezado lleva en qué fase está el frente y cuánto hay esperando
// aprobación: si eso ya contesta la pregunta, no hace falta abrir.
//
// Mismo patrón colapsable que `LineaTiempoObra`, a propósito: una pantalla
// con dos formas distintas de plegar una sección se siente como dos
// productos.
// ─────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { ChevronDown, Check, Layers } from "lucide-react";
import type { ResumenFases } from "@/lib/fases-avance";

/** Ancho mínimo visible de un tramo: un solo día de trabajo en una fase de
 *  ochocientas tareas es 0.1% y desaparecería. Se le da un pelo de ancho para
 *  que exista, porque «hay algo devuelto» importa más que cuánto. */
const MINIMO = 1.2;
const ancho = (x: number, t: number) => (t > 0 && x > 0 ? Math.max(MINIMO, (x / t) * 100) : 0);

export default function AvanceFases({
  resumen,
  defaultAbierto = false,
}: {
  resumen: ResumenFases;
  /** Cerrada por defecto: las torres van debajo y son lo que se vino a ver. */
  defaultAbierto?: boolean;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(defaultAbierto);
  if (resumen.fases.length === 0) return null;

  const frente = resumen.frente >= 0 ? resumen.fases[resumen.frente] : null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <span className="min-w-0">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
            Fases de la obra
          </span>
          <span className="block text-xs text-slate-500 mt-0.5 truncate">
            {resumen.fases.length} fases
            {frente && <> · ahora en <strong className="text-slate-700 font-semibold">{frente.nombre}</strong></>}
          </span>
        </span>
        <span className="flex items-center gap-3 text-xs text-slate-500 whitespace-nowrap">
          {/* «por revisar» es el número que justifica abrir la sección, así que
              se muestra siempre. Las devueltas ceden en pantalla angosta. */}
          {resumen.totalReportadas > 0 && (
            <span>
              <strong className="text-slate-800">{resumen.totalReportadas}</strong> por revisar
            </span>
          )}
          {resumen.totalDevueltas > 0 && (
            <span className="hidden sm:inline text-red-600">
              <strong>{resumen.totalDevueltas}</strong> devueltas
            </span>
          )}
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
        </span>
      </button>

      {abierto && (
      <div className="px-5 sm:px-6 pb-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <i className="w-3.5 h-2 rounded-sm bg-blue-600" /> Aprobado
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-3.5 h-2 rounded-sm bg-blue-300" /> Esperando revisión
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-3.5 h-2 rounded-sm bg-red-500" /> Devuelto
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {resumen.fases.map((f, i) => {
          const esFrente = i === resumen.frente;
          const abierto = abierta === f.id;
          return (
            <li
              key={f.id}
              className={`rounded-xl border bg-white overflow-hidden transition-colors ${
                esFrente ? "border-blue-200 ring-2 ring-blue-50" : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => setAbierta(abierto ? null : f.id)}
                aria-expanded={abierto}
                className="w-full grid grid-cols-[26px_minmax(0,1.7fr)_minmax(90px,1.4fr)_auto_16px] gap-3 sm:gap-4 items-center px-3 sm:px-4 py-3 text-left cursor-pointer"
              >
                <span
                  className={`w-[26px] h-[26px] rounded-lg grid place-items-center text-[11px] font-extrabold ${
                    f.completa ? "bg-green-50 text-green-600"
                      : esFrente ? "bg-blue-600 text-white"
                      : "bg-slate-50 text-slate-500 border border-slate-100"
                  }`}
                >
                  {f.completa ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : f.orden}
                </span>

                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 truncate">
                    {f.nombre}
                    {esFrente && (
                      <span className="ml-2 align-[1px] inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                        más por revisar
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-400 truncate mt-0.5">
                    {f.aprobadas}/{f.total} tareas
                    {f.reportadas > 0 && ` · ${f.reportadas} por revisar`}
                    {f.devueltas > 0 && (
                      <span className="text-red-600"> · {f.devueltas} devuelta{f.devueltas > 1 ? "s" : ""}</span>
                    )}
                  </span>
                </span>

                <span className="flex h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <span className="bg-blue-600" style={{ width: `${ancho(f.aprobadas, f.total)}%` }} />
                  <span className="bg-blue-300" style={{ width: `${ancho(f.reportadas, f.total)}%` }} />
                  <span className="bg-red-500" style={{ width: `${ancho(f.devueltas, f.total)}%` }} />
                </span>

                <span className="flex items-baseline gap-1.5 justify-end whitespace-nowrap">
                  <span className="text-base font-extrabold tabular-nums text-slate-900">
                    {f.porcentajeAprobado}%
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">aprobado</span>
                </span>

                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${abierto ? "rotate-180" : ""}`}
                />
              </button>

              {abierto && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-3 sm:px-4 pt-3 pb-4">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Reparto por torre
                  </p>
                  <div className="flex flex-col">
                    {f.reparto.map((r, k) => {
                      const sinEmpezar = r.aprobadas + r.reportadas === 0;
                      const p = r.total > 0 ? Math.round((r.aprobadas / r.total) * 100) : 0;
                      return (
                        <div
                          key={r.nombre}
                          className={`grid grid-cols-[62px_minmax(60px,1fr)_auto] gap-3 items-center py-1.5 ${
                            k > 0 ? "border-t border-slate-200/70" : ""
                          }`}
                        >
                          <span className="text-xs font-bold text-slate-600 truncate">{r.nombre}</span>
                          <span className="flex h-2 rounded-full bg-slate-200/80 overflow-hidden">
                            <span className="bg-blue-600" style={{ width: `${ancho(r.aprobadas, r.total)}%` }} />
                            <span className="bg-blue-300" style={{ width: `${ancho(r.reportadas, r.total)}%` }} />
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap text-right">
                            {sinEmpezar ? (
                              <span className="italic font-semibold">sin empezar</span>
                            ) : (
                              <>
                                <span className="text-slate-800 text-xs tabular-nums">{p}%</span>
                                {" · "}
                                <span className="tabular-nums">{r.aprobadas}/{r.total}</span>
                                {r.reportadas > 0 && ` · ${r.reportadas} por revisar`}
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      </div>
      )}
    </div>
  );
}
