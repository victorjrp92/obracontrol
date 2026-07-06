"use client";

// ─────────────────────────────────────────────────────────────────────────
// Paso de REVISIÓN del import (B2C). Modal mobile-first. NO decide fila por
// fila: agrupa las decisiones (incluir sin presupuesto, estimar división
// M.O./materiales, mapear fases raras, reasignar ubicaciones huérfanas, incluir
// duplicadas) y entrega al wizard la lista de tareas RESUELTAS para crearlas.
// ─────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { X, CheckCircle2, AlertTriangle, MapPin, Layers, Copy, Wallet } from "lucide-react";
import { FASES_OBRA, faseDeTarea, type FaseObra } from "@/lib/fases-obra";
import { pctManoObraDeTarea } from "@/lib/precios-semilla";
import { dividirCosto } from "@/lib/estimar-presupuesto";
import type { DestinoUbicacion, EstructuraPlantilla } from "@/lib/plantilla-obra";
import type { FilaPreview, ResumenPreview, TareaImportadaResuelta } from "./import-excel-types";

/** Clave estable para una ubicación huérfana / vacía (para agrupar decisiones). */
function claveUbic(f: FilaPreview): string {
  return f.ubicacion.trim() || "__sin__";
}

/** Opción de reasignación de ubicación (destino existente o global). */
interface OpcionDestino {
  value: string;
  label: string;
  destino: DestinoUbicacion;
}

function Chip({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${tone}`}>
      <div className="text-lg font-bold leading-none">{n}</div>
      <div className="text-[10px] font-medium mt-1 leading-tight">{label}</div>
    </div>
  );
}

export default function RevisionImportExcel({
  filas,
  resumen,
  estructura,
  onConfirmar,
  onCerrar,
}: {
  filas: FilaPreview[];
  resumen: ResumenPreview;
  estructura: EstructuraPlantilla;
  onConfirmar: (tareas: TareaImportadaResuelta[]) => void;
  onCerrar: () => void;
}) {
  const multiPiso = estructura.pisos.length > 1;

  // Opciones de destino para reasignar ubicaciones huérfanas.
  const opcionesDestino = useMemo<OpcionDestino[]>(() => {
    const base: OpcionDestino[] = [
      { value: "propiedad", label: "Toda la propiedad", destino: { tipo: "propiedad" } },
    ];
    for (const p of estructura.pisos) {
      for (const e of p.espacios) {
        base.push({
          value: `espacio:${p.numero}:${e}`,
          label: multiPiso ? `Piso ${p.numero} – ${e}` : e,
          destino: { tipo: "espacio", piso: p.numero, espacio: e },
        });
      }
    }
    return base;
  }, [estructura, multiPiso]);

  // Filas que se pueden convertir en tarea (tienen nombre).
  const aplicables = useMemo(() => filas.filter((f) => f.tarea.trim()), [filas]);
  const sinNombre = filas.length - aplicables.length;

  // Grupos de decisión.
  const sinPresupuesto = aplicables.filter((f) => (f.total ?? 0) <= 0);
  const soloTotal = aplicables.filter((f) => f.flags.includes("solo_total"));
  const duplicadas = aplicables.filter((f) => f.flags.includes("duplicada"));
  const orphanKeys = useMemo(() => {
    const m = new Map<string, FilaPreview>();
    for (const f of aplicables) {
      if (!f.ubicacionValida) m.set(claveUbic(f), f);
    }
    return m;
  }, [aplicables]);

  // ── Estado de las decisiones ────────────────────────────────────────────
  const [incluirSinPresupuesto, setIncluirSinPresupuesto] = useState(true);
  const [estimarDivision, setEstimarDivision] = useState(false);
  const [incluirDuplicadas, setIncluirDuplicadas] = useState(false);
  const [faseMap, setFaseMap] = useState<Record<string, FaseObra | "">>(() =>
    Object.fromEntries(resumen.fasesNoReconocidas.map((f) => [f, "" as const])),
  );
  const [ubicMap, setUbicMap] = useState<Record<string, string>>(() =>
    Object.fromEntries([...orphanKeys.keys()].map((k) => [k, "propiedad"])),
  );

  // ── Resolución (usada para el conteo y para confirmar) ────────────────────
  const resolver = useMemo<TareaImportadaResuelta[]>(() => {
    const out: TareaImportadaResuelta[] = [];
    for (const f of aplicables) {
      if (f.flags.includes("duplicada") && !incluirDuplicadas) continue;

      const tienePresupuesto = (f.total ?? 0) > 0;
      if (!tienePresupuesto && !incluirSinPresupuesto) continue;

      // Destino.
      let destino: DestinoUbicacion | undefined;
      if (f.ubicacionValida && f.destino) {
        destino = f.destino;
      } else {
        const opt = ubicMap[claveUbic(f)];
        if (opt === "descartar" || !opt) continue;
        destino = opcionesDestino.find((o) => o.value === opt)?.destino;
      }
      if (!destino) continue;

      // Fase.
      let fase: FaseObra | undefined;
      if (f.faseNormalizada) fase = f.faseNormalizada;
      else if (f.flags.includes("fase_no_reconocida")) fase = faseMap[f.fase] || undefined;
      else fase = faseDeTarea(f.tarea) ?? undefined;

      // Presupuesto + desglose.
      const precio = tienePresupuesto ? f.total : undefined;
      let manoObra = f.manoObra;
      let materiales = f.materiales;
      if (f.flags.includes("solo_total") && tienePresupuesto && estimarDivision) {
        const div = dividirCosto(f.total!, pctManoObraDeTarea(f.tarea));
        manoObra = div.manoObra;
        materiales = div.materiales;
      }

      out.push({
        nombre: f.tarea,
        destino,
        ...(fase ? { fase } : {}),
        ...(precio != null ? { precio } : {}),
        ...(manoObra != null ? { presupuestoManoObra: manoObra } : {}),
        ...(materiales != null ? { presupuestoMateriales: materiales } : {}),
      });
    }
    return out;
  }, [
    aplicables,
    incluirDuplicadas,
    incluirSinPresupuesto,
    estimarDivision,
    faseMap,
    ubicMap,
    opcionesDestino,
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Encabezado */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Revisa lo que importaste</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirma un par de cosas y agregamos las tareas a tu obra.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
          {/* Resumen */}
          <div className="grid grid-cols-4 gap-2">
            <Chip n={resumen.validas} label="tareas válidas" tone="bg-blue-50 text-blue-700" />
            <Chip n={resumen.conPresupuesto} label="con presupuesto" tone="bg-emerald-50 text-emerald-700" />
            <Chip n={resumen.conFlags} label="con avisos" tone="bg-amber-50 text-amber-700" />
            <Chip
              n={resumen.omitidas + sinNombre}
              label="omitidas"
              tone="bg-slate-100 text-slate-500"
            />
          </div>

          {/* (1) Sin presupuesto */}
          {sinPresupuesto.length > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirSinPresupuesto}
                onChange={(e) => setIncluirSinPresupuesto(e.target.checked)}
                className="mt-0.5 accent-blue-600 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-400" /> Incluir {sinPresupuesto.length}{" "}
                  {sinPresupuesto.length === 1 ? "tarea" : "tareas"} sin presupuesto
                </span>
                <span className="text-xs text-slate-500">
                  Vienen en 0 o marcadas “opcional”. Se agregan como tareas, sin monto.
                </span>
              </span>
            </label>
          )}

          {/* (2) Solo total → división */}
          {soloTotal.length > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={estimarDivision}
                onChange={(e) => setEstimarDivision(e.target.checked)}
                className="mt-0.5 accent-blue-600 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-semibold text-slate-800">
                  Estimar la división trabajo / materiales para {soloTotal.length}{" "}
                  {soloTotal.length === 1 ? "tarea" : "tareas"}
                </span>
                <span className="text-xs text-slate-500">
                  Trajeron solo el total. Podemos repartirlo en mano de obra y materiales con
                  precios de referencia. Si prefieres, déjalo solo como total.
                </span>
              </span>
            </label>
          )}

          {/* (3) Fases no reconocidas */}
          {resumen.fasesNoReconocidas.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" /> Fases por reconocer
              </p>
              {resumen.fasesNoReconocidas.map((f) => (
                <div key={f} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-600 flex-1 min-w-0 truncate" title={f}>
                    “{f}”
                  </span>
                  <select
                    value={faseMap[f] ?? ""}
                    onChange={(e) =>
                      setFaseMap((prev) => ({ ...prev, [f]: e.target.value as FaseObra | "" }))
                    }
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[55%]"
                  >
                    <option value="">Sin fase</option>
                    {FASES_OBRA.map((fase) => (
                      <option key={fase} value={fase}>
                        {fase}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* (4) Ubicaciones huérfanas */}
          {orphanKeys.size > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" /> Ubicaciones por reasignar
              </p>
              {[...orphanKeys.entries()].map(([k, f]) => (
                <div key={k} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">
                    {f.ubicacion.trim() ? `“${f.ubicacion.trim()}”` : "Sin ubicación"}
                  </span>
                  <select
                    value={ubicMap[k] ?? "propiedad"}
                    onChange={(e) => setUbicMap((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[55%]"
                  >
                    {opcionesDestino.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    <option value="descartar">Descartar estas filas</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* (5) Duplicadas */}
          {duplicadas.length > 0 && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirDuplicadas}
                onChange={(e) => setIncluirDuplicadas(e.target.checked)}
                className="mt-0.5 accent-blue-600 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-slate-400" /> Incluir {duplicadas.length}{" "}
                  {duplicadas.length === 1 ? "fila repetida" : "filas repetidas"}
                </span>
                <span className="text-xs text-slate-500">
                  Tienen la misma tarea y ubicación que otra. Por defecto no las agregamos.
                </span>
              </span>
            </label>
          )}

          {resolver.length === 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              Con estas opciones no se agregaría ninguna tarea. Ajusta las decisiones de arriba.
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCerrar}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-xl text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(resolver)}
            disabled={resolver.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm cursor-pointer shadow-sm shadow-blue-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            Agregar {resolver.length} {resolver.length === 1 ? "tarea" : "tareas"} a mi obra
          </button>
        </div>
      </div>
    </div>
  );
}
