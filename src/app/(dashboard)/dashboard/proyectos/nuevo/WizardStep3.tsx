"use client";

import { useState } from "react";
import {
  ArrowLeft, Building2, Calendar, ChevronDown, ChevronRight,
  Layers, Plus, Save, Trash2, UserPlus, X,
} from "lucide-react";
import type {
  Contratista, TareaInput, TipoUnidadInput, EdificioInput, FaseAssignment, TorreAssignment,
  PersonaProyectoInput, AsignacionOverride,
} from "./wizard-types";
import { SUBFASES_MADERA, generateUnitNamesForTorre } from "./wizard-types";

interface WizardStep3Props {
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  diasHabiles: number;
  edificios: EdificioInput[];
  tiposUnidad: TipoUnidadInput[];
  fasesSeleccionadas: string[];
  tareas: TareaInput[];
  contratistas: Contratista[];
  totalUnidades: number;
  totalTareasGlobal: number;
  loading: boolean;
  isEditMode?: boolean;
  personas: PersonaProyectoInput[];
  setPersonas: React.Dispatch<React.SetStateAction<PersonaProyectoInput[]>>;
  asignacionesSubfase: Record<string, Record<string, Record<string, string | null>>>;
  setAsignacionesSubfase: React.Dispatch<React.SetStateAction<Record<string, Record<string, Record<string, string | null>>>>>;
  asignaciones: AsignacionOverride[];
  setAsignaciones: React.Dispatch<React.SetStateAction<AsignacionOverride[]>>;
  onBack: () => void;
  onSubmit: (resolvedTareas?: TareaInput[], overrides?: AsignacionOverride[]) => void;
}

function buildInitialAssignments(
  fasesSeleccionadas: string[],
  edificios: EdificioInput[],
): FaseAssignment[] {
  return fasesSeleccionadas.map((fase) => ({
    fase,
    contratistas: [],
    distribucion: Object.fromEntries(
      edificios.map((e) => [
        e.nombre,
        { contratista_global: null, desglosado: false, por_actividad: {} } as TorreAssignment,
      ])
    ),
  }));
}

function AdvancedPanel({
  fase, edif, tiposUnidad, tareas, contratistaPool, contratistas,
  getAptOverride, setAptOverride, getTaskOverride, setTaskOverride,
  expandedApt, setExpandedApt,
}: {
  fase: string;
  edif: EdificioInput;
  tiposUnidad: TipoUnidadInput[];
  tareas: TareaInput[];
  contratistaPool: string[];
  contratistas: Contratista[];
  getAptOverride: (fase: string, torre: string, unidad: string) => string | null;
  setAptOverride: (fase: string, torre: string, unidad: string, cId: string | null) => void;
  getTaskOverride: (fase: string, torre: string, unidad: string, espacio: string, tarea: string) => string | null;
  setTaskOverride: (fase: string, torre: string, unidad: string, espacio: string, tarea: string, cId: string | null) => void;
  expandedApt: string | null;
  setExpandedApt: (v: string | null) => void;
}) {
  const units = generateUnitNamesForTorre(edif, tiposUnidad);
  const floors = [...new Set(units.map((u) => u.piso))].sort((a, b) => a - b);
  const faseTareas = tareas.filter((t) => t.fase === fase);

  return (
    <div className="mt-3 border border-violet-200 rounded-lg bg-violet-50/40 p-3">
      <div className="text-[11px] font-semibold text-violet-700 mb-2">Por apartamento</div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {floors.map((piso) => {
          const floorUnits = units.filter((u) => u.piso === piso);
          return (
            <div key={piso}>
              <div className="text-[10px] font-bold text-slate-500 mb-1">Piso {piso}</div>
              <div className="space-y-1">
                {floorUnits.map((unit) => {
                  const aptKey = `${fase}::${edif.nombre}::${unit.nombre}`;
                  const isExpanded = expandedApt === aptKey;
                  const aptContratista = getAptOverride(fase, edif.nombre, unit.nombre);
                  const tipo = tiposUnidad.find((t) => t.id === unit.tipo_unidad_id);

                  return (
                    <div key={unit.nombre} className="bg-white rounded border border-slate-100">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <button
                          onClick={() => setExpandedApt(isExpanded ? null : aptKey)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />}
                        </button>
                        <span className="text-xs font-medium text-slate-700 w-12">{unit.nombre}</span>
                        {tipo && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{tipo.nombre}</span>
                        )}
                        <select
                          value={aptContratista ?? ""}
                          onChange={(e) => setAptOverride(fase, edif.nombre, unit.nombre, e.target.value || null)}
                          className="ml-auto text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-white max-w-[150px]"
                        >
                          <option value="">Hereda torre</option>
                          {contratistaPool.map((cId) => {
                            const c = contratistas.find((x) => x.id === cId);
                            return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                          })}
                        </select>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-3 py-2 space-y-1.5 bg-slate-50/50">
                          {faseTareas
                            .filter((t) => !t.tipo_unidad_id || t.tipo_unidad_id === unit.tipo_unidad_id)
                            .map((t) => {
                              const isMadera = fase === "Madera";
                              const subfases = isMadera && !t.lustro_excluido
                                ? ["Instalación", "Detallado y lustro"] as const
                                : [isMadera ? "Instalación" : (t.subfase ?? null)] as const;

                              return subfases.map((sf) => {
                                const taskKey = `${t.nombre}::${sf ?? ""}`;
                                const taskContratista = getTaskOverride(
                                  fase, edif.nombre, unit.nombre, t.espacio, `${t.nombre}${sf ? `::${sf}` : ""}`
                                );
                                return (
                                  <div key={taskKey} className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[10px] text-slate-600 truncate block">
                                        {t.espacio} — {t.nombre}
                                        {sf && <span className="text-violet-500 ml-1">({sf === "Instalación" ? "Inst." : "Lustro"})</span>}
                                      </span>
                                    </div>
                                    <select
                                      value={taskContratista ?? ""}
                                      onChange={(e) => setTaskOverride(
                                        fase, edif.nombre, unit.nombre, t.espacio,
                                        `${t.nombre}${sf ? `::${sf}` : ""}`,
                                        e.target.value || null,
                                      )}
                                      className="text-[10px] px-1 py-0.5 rounded border border-slate-200 bg-white max-w-[130px]"
                                    >
                                      <option value="">Hereda</option>
                                      {contratistaPool.map((cId) => {
                                        const c = contratistas.find((x) => x.id === cId);
                                        return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                      })}
                                    </select>
                                  </div>
                                );
                              });
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WizardStep3({
  nombre,
  subtipo,
  diasHabiles,
  edificios,
  tiposUnidad,
  fasesSeleccionadas,
  tareas,
  contratistas,
  totalUnidades,
  totalTareasGlobal,
  loading,
  isEditMode,
  personas,
  setPersonas,
  asignacionesSubfase,
  setAsignacionesSubfase,
  asignaciones,
  setAsignaciones,
  onBack,
  onSubmit,
}: WizardStep3Props) {
  const [assignments, setAssignments] = useState<FaseAssignment[]>(() =>
    buildInitialAssignments(fasesSeleccionadas, edificios)
  );

  // Compute all unique spaces from current tasks
  const allEspacios = [...new Set(tareas.map((t) => t.espacio))];

  // Advanced assignment state
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
  const [expandedApt, setExpandedApt] = useState<string | null>(null);

  function getAptOverride(fase: string, torre: string, unidad: string): string | null {
    return asignaciones.find(
      (o) => o.fase === fase && o.torre === torre && o.unidad_nombre === unidad && !o.espacio && !o.tarea_nombre
    )?.contratista_id ?? null;
  }

  function setAptOverride(fase: string, torre: string, unidad: string, contratistaId: string | null) {
    setAsignaciones((prev) => {
      const filtered = prev.filter(
        (o) => !(o.fase === fase && o.torre === torre && o.unidad_nombre === unidad && !o.espacio && !o.tarea_nombre)
      );
      if (contratistaId) {
        filtered.push({ fase, torre, unidad_nombre: unidad, contratista_id: contratistaId });
      }
      return filtered;
    });
  }

  function getTaskOverride(fase: string, torre: string, unidad: string, espacio: string, tarea: string): string | null {
    return asignaciones.find(
      (o) => o.fase === fase && o.torre === torre && o.unidad_nombre === unidad && o.espacio === espacio && o.tarea_nombre === tarea
    )?.contratista_id ?? null;
  }

  function setTaskOverride(fase: string, torre: string, unidad: string, espacio: string, tarea: string, contratistaId: string | null) {
    setAsignaciones((prev) => {
      const filtered = prev.filter(
        (o) => !(o.fase === fase && o.torre === torre && o.unidad_nombre === unidad && o.espacio === espacio && o.tarea_nombre === tarea)
      );
      if (contratistaId) {
        filtered.push({ fase, torre, unidad_nombre: unidad, espacio, tarea_nombre: tarea, contratista_id: contratistaId });
      }
      return filtered;
    });
  }

  // Global task-level overrides (no torre/unidad — applies everywhere)
  const [globalTaskOpen, setGlobalTaskOpen] = useState<Record<string, boolean>>({});

  function getGlobalTaskOverride(fase: string, tareaKey: string): string | null {
    return asignaciones.find(
      (o) => o.fase === fase && o.tarea_nombre === tareaKey && !o.torre && !o.unidad_nombre && !o.espacio
    )?.contratista_id ?? null;
  }

  function setGlobalTaskOverride(fase: string, tareaKey: string, contratistaId: string | null) {
    setAsignaciones((prev) => {
      const filtered = prev.filter(
        (o) => !(o.fase === fase && o.tarea_nombre === tareaKey && !o.torre && !o.unidad_nombre && !o.espacio)
      );
      if (contratistaId) {
        filtered.push({ fase, tarea_nombre: tareaKey, contratista_id: contratistaId });
      }
      return filtered;
    });
  }

  function updateAssignment(faseIdx: number, updater: (a: FaseAssignment) => FaseAssignment) {
    setAssignments((prev) => prev.map((a, i) => i === faseIdx ? updater(a) : a));
  }

  function addContratistaToFase(faseIdx: number, contratistaId: string) {
    updateAssignment(faseIdx, (a) => ({
      ...a,
      contratistas: a.contratistas.includes(contratistaId)
        ? a.contratistas
        : [...a.contratistas, contratistaId],
    }));
  }

  function removeContratistaFromFase(faseIdx: number, contratistaId: string) {
    updateAssignment(faseIdx, (a) => {
      // Also clear from any torre assignments
      const newDist: Record<string, TorreAssignment> = {};
      for (const [torre, ta] of Object.entries(a.distribucion)) {
        newDist[torre] = {
          ...ta,
          contratista_global: ta.contratista_global === contratistaId ? null : ta.contratista_global,
          por_actividad: Object.fromEntries(
            Object.entries(ta.por_actividad).map(([esp, cId]) => [esp, cId === contratistaId ? null : cId])
          ),
        };
      }
      return {
        ...a,
        contratistas: a.contratistas.filter((id) => id !== contratistaId),
        distribucion: newDist,
      };
    });
  }

  function setTorreGlobal(faseIdx: number, torre: string, contratistaId: string | null) {
    updateAssignment(faseIdx, (a) => ({
      ...a,
      distribucion: {
        ...a.distribucion,
        [torre]: {
          ...a.distribucion[torre],
          contratista_global: contratistaId,
        },
      },
    }));
  }

  function toggleDesglose(faseIdx: number, torre: string) {
    updateAssignment(faseIdx, (a) => ({
      ...a,
      distribucion: {
        ...a.distribucion,
        [torre]: {
          ...a.distribucion[torre],
          desglosado: !a.distribucion[torre].desglosado,
        },
      },
    }));
  }

  function setActividadContratista(faseIdx: number, torre: string, espacio: string, contratistaId: string | null) {
    updateAssignment(faseIdx, (a) => ({
      ...a,
      distribucion: {
        ...a.distribucion,
        [torre]: {
          ...a.distribucion[torre],
          por_actividad: {
            ...a.distribucion[torre].por_actividad,
            [espacio]: contratistaId,
          },
        },
      },
    }));
  }

  function handleCreate() {
    const overlay: AsignacionOverride[] = [...asignaciones];

    for (const [fase, torres] of Object.entries(asignacionesSubfase)) {
      for (const [torre, subfases] of Object.entries(torres)) {
        for (const [subfase, cId] of Object.entries(subfases)) {
          if (cId) overlay.push({ fase, subfase, torre, contratista_id: cId });
        }
      }
    }

    for (const fa of assignments) {
      for (const [torre, ta] of Object.entries(fa.distribucion)) {
        if (ta.desglosado) {
          for (const [espacio, cId] of Object.entries(ta.por_actividad)) {
            if (cId) overlay.push({ fase: fa.fase, torre, espacio, contratista_id: cId });
          }
        } else if (ta.contratista_global) {
          overlay.push({ fase: fa.fase, torre, contratista_id: ta.contratista_global });
        }
      }
    }

    onSubmit(undefined, overlay);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Resumen del proyecto</h2>
      <p className="text-sm text-slate-500 mb-5">
        Revisa los detalles y asigna contratistas por fase y torre (opcional)
      </p>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Proyecto</div>
          <div className="text-sm font-bold text-slate-900 truncate">{nombre}</div>
        </div>
        {subtipo !== "ZONAS_COMUNES" && (
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-500">Unidades</div>
            <div className="text-sm font-bold text-slate-900">{totalUnidades}</div>
          </div>
        )}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500">Tareas totales</div>
          <div className="text-sm font-bold text-slate-900">{totalTareasGlobal}</div>
        </div>
        {subtipo !== "ZONAS_COMUNES" && (
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />Torres</div>
            <div className="text-sm font-bold text-slate-900">{edificios.length}</div>
          </div>
        )}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500 flex items-center gap-1"><Layers className="w-3 h-3" />Fases</div>
          <div className="text-sm font-bold text-slate-900">{fasesSeleccionadas.length}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Dias/sem</div>
          <div className="text-sm font-bold text-slate-900">{diasHabiles}</div>
        </div>
      </div>

      {/* Hierarchical assignment */}
      {contratistas.length > 0 ? (
        <div className="mb-6 space-y-6">
          {assignments.map((faseAssign, faseIdx) => (
            <div key={faseAssign.fase} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Fase header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800">{faseAssign.fase}</h3>
              </div>

              <div className="p-4">
                {/* Contratistas for this phase */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Contratistas para esta fase:
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {faseAssign.contratistas.map((cId) => {
                      const c = contratistas.find((x) => x.id === cId);
                      if (!c) return null;
                      return (
                        <span
                          key={cId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                        >
                          {c.nombre}
                          <button
                            onClick={() => removeContratistaFromFase(faseIdx, cId)}
                            className="hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {/* Add contratista dropdown */}
                  {contratistas.filter((c) => !faseAssign.contratistas.includes(c.id)).length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addContratistaToFase(faseIdx, e.target.value);
                          e.target.value = "";
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="" disabled>+ Agregar contratista</option>
                        {contratistas
                          .filter((c) => !faseAssign.contratistas.includes(c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Global per-task assignment */}
                {faseAssign.contratistas.length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => setGlobalTaskOpen((prev) => ({ ...prev, [faseAssign.fase]: !prev[faseAssign.fase] }))}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 mb-2"
                    >
                      {globalTaskOpen[faseAssign.fase]
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                      Asignar por tarea (global)
                    </button>
                    {globalTaskOpen[faseAssign.fase] && (
                      <div className="border border-emerald-200 rounded-lg bg-emerald-50/40 p-3 space-y-1.5 max-h-52 overflow-y-auto">
                        <p className="text-[10px] text-emerald-600 mb-1">Aplica a todas las torres y apartamentos</p>
                        {tareas
                          .filter((t) => t.fase === faseAssign.fase)
                          .flatMap((t) => {
                            const isMadera = faseAssign.fase === "Madera";
                            if (isMadera) {
                              const rows: { key: string; label: string; espacio: string; tag: string | null }[] = [
                                { key: `${t.nombre}::Instalación`, label: t.nombre, espacio: t.espacio, tag: "Inst." },
                              ];
                              if (!t.lustro_excluido) {
                                rows.push({ key: `${t.nombre}::Detallado y lustro`, label: t.nombre, espacio: t.espacio, tag: "Lustro" });
                              }
                              return rows;
                            }
                            const sfKey = t.subfase ? `${t.nombre}::${t.subfase}` : t.nombre;
                            return [{ key: sfKey, label: t.nombre, espacio: t.espacio, tag: t.subfase ?? null }];
                          })
                          .map(({ key, label, espacio, tag }) => (
                            <div key={key} className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] text-slate-700 truncate block">
                                  {espacio} — {label}
                                  {tag && <span className="text-emerald-600 ml-1 text-[10px]">({tag})</span>}
                                </span>
                              </div>
                              <select
                                value={getGlobalTaskOverride(faseAssign.fase, key) ?? ""}
                                onChange={(e) => setGlobalTaskOverride(faseAssign.fase, key, e.target.value || null)}
                                className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-white max-w-[150px]"
                              >
                                <option value="">Sin asignar</option>
                                {faseAssign.contratistas.map((cId) => {
                                  const c = contratistas.find((x) => x.id === cId);
                                  return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                })}
                              </select>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Distribution by tower */}
                {faseAssign.contratistas.length > 0 && subtipo !== "ZONAS_COMUNES" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">Distribución:</label>
                    <div className="grid gap-3">
                      {edificios.map((edif) => {
                        const isMadera = faseAssign.fase === "Madera";

                        if (isMadera) {
                          const subfaseAssign = asignacionesSubfase[faseAssign.fase]?.[edif.nombre] ?? {};
                          return (
                            <div key={edif.nombre} className="border border-violet-100 rounded-lg p-3 bg-violet-50/30">
                              <span className="text-xs font-bold text-slate-700 mb-2 block">{edif.nombre}</span>
                              <div className="space-y-1.5">
                                {SUBFASES_MADERA.map((subfase) => (
                                  <div key={subfase} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-600 w-36 truncate">{subfase}:</span>
                                    <select
                                      value={subfaseAssign[subfase] ?? ""}
                                      onChange={(e) => {
                                        setAsignacionesSubfase((prev) => ({
                                          ...prev,
                                          [faseAssign.fase]: {
                                            ...prev[faseAssign.fase],
                                            [edif.nombre]: {
                                              ...prev[faseAssign.fase]?.[edif.nombre],
                                              [subfase]: e.target.value || null,
                                            },
                                          },
                                        }));
                                      }}
                                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white max-w-[180px]"
                                    >
                                      <option value="">Sin asignar</option>
                                      {faseAssign.contratistas.map((cId) => {
                                        const c = contratistas.find((x) => x.id === cId);
                                        return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                      })}
                                    </select>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  const key = `${faseAssign.fase}::${edif.nombre}`;
                                  setAdvancedOpen((prev) => ({ ...prev, [key]: !prev[key] }));
                                }}
                                className="mt-2 text-[10px] text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                              >
                                <Layers className="w-3 h-3" />
                                {advancedOpen[`${faseAssign.fase}::${edif.nombre}`] ? "Cerrar avanzado" : "Asignación avanzada"}
                              </button>
                              {advancedOpen[`${faseAssign.fase}::${edif.nombre}`] && (
                                <AdvancedPanel
                                  fase={faseAssign.fase}
                                  edif={edif}
                                  tiposUnidad={tiposUnidad}
                                  tareas={tareas}
                                  contratistaPool={faseAssign.contratistas}
                                  contratistas={contratistas}
                                  getAptOverride={getAptOverride}
                                  setAptOverride={setAptOverride}
                                  getTaskOverride={getTaskOverride}
                                  setTaskOverride={setTaskOverride}
                                  expandedApt={expandedApt}
                                  setExpandedApt={setExpandedApt}
                                />
                              )}
                            </div>
                          );
                        }

                        const torreAssign = faseAssign.distribucion[edif.nombre] ?? {
                          contratista_global: null,
                          desglosado: false,
                          por_actividad: {},
                        };

                        return (
                          <div key={edif.nombre} className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-700">{edif.nombre}</span>
                            </div>

                            {!torreAssign.desglosado ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Todas las tareas:</span>
                                <select
                                  value={torreAssign.contratista_global ?? ""}
                                  onChange={(e) => setTorreGlobal(faseIdx, edif.nombre, e.target.value || null)}
                                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white max-w-[180px]"
                                >
                                  <option value="">Sin asignar</option>
                                  {faseAssign.contratistas.map((cId) => {
                                    const c = contratistas.find((x) => x.id === cId);
                                    return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                  })}
                                </select>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {allEspacios.map((espacio) => {
                                  const hasTasks = tareas.some((t) => t.fase === faseAssign.fase && t.espacio === espacio);
                                  if (!hasTasks) return null;
                                  return (
                                    <div key={espacio} className="flex items-center gap-2">
                                      <span className="text-xs text-slate-600 w-32 truncate">{espacio}:</span>
                                      <select
                                        value={torreAssign.por_actividad[espacio] ?? ""}
                                        onChange={(e) => setActividadContratista(faseIdx, edif.nombre, espacio, e.target.value || null)}
                                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white max-w-[180px]"
                                      >
                                        <option value="">Sin asignar</option>
                                        {faseAssign.contratistas.map((cId) => {
                                          const c = contratistas.find((x) => x.id === cId);
                                          return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                        })}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-2">
                              <button
                                onClick={() => toggleDesglose(faseIdx, edif.nombre)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              >
                                {torreAssign.desglosado
                                  ? <><ChevronDown className="w-3 h-3" /> Asignar todas a uno</>
                                  : <><ChevronRight className="w-3 h-3" /> Desglosar por actividad</>
                                }
                              </button>
                              <button
                                onClick={() => {
                                  const key = `${faseAssign.fase}::${edif.nombre}`;
                                  setAdvancedOpen((prev) => ({ ...prev, [key]: !prev[key] }));
                                }}
                                className="text-[10px] text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                              >
                                <Layers className="w-3 h-3" />
                                {advancedOpen[`${faseAssign.fase}::${edif.nombre}`] ? "Cerrar avanzado" : "Asignación avanzada"}
                              </button>
                            </div>

                            {advancedOpen[`${faseAssign.fase}::${edif.nombre}`] && (
                              <AdvancedPanel
                                fase={faseAssign.fase}
                                edif={edif}
                                tiposUnidad={tiposUnidad}
                                tareas={tareas}
                                contratistaPool={faseAssign.contratistas}
                                contratistas={contratistas}
                                getAptOverride={getAptOverride}
                                setAptOverride={setAptOverride}
                                getTaskOverride={getTaskOverride}
                                setTaskOverride={setTaskOverride}
                                expandedApt={expandedApt}
                                setExpandedApt={setExpandedApt}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {faseAssign.contratistas.length === 0 && (
                  <p className="text-xs text-slate-400">Agrega contratistas para asignarlos a las torres</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          No hay contratistas registrados. Puedes invitarlos despues desde Usuarios y asignarlos a las tareas.
        </div>
      )}

      {/* Personal vinculado (opcional) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Personal vinculado</h3>
            <span className="text-[10px] text-slate-400 font-medium">(opcional)</span>
          </div>
          <button
            onClick={() => setPersonas([...personas, { id: `p${Date.now()}`, nombre: "", cargo: "", email: "" }])}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar persona
          </button>
        </div>

        {personas.length === 0 ? (
          <p className="text-xs text-slate-400">Puedes vincular personas externas al proyecto (ej: interventor, arquitecto, cliente)</p>
        ) : (
          <div className="flex flex-col gap-3">
            {personas.map((p, idx) => (
              <div key={p.id} className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex-1 grid sm:grid-cols-3 gap-2">
                  <input
                    value={p.nombre}
                    onChange={(e) => setPersonas(personas.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))}
                    placeholder="Nombre"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <input
                    value={p.cargo}
                    onChange={(e) => setPersonas(personas.map((x, i) => i === idx ? { ...x, cargo: e.target.value } : x))}
                    placeholder="Cargo (ej: Interventor)"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <input
                    value={p.email}
                    onChange={(e) => setPersonas(personas.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))}
                    placeholder="Email (opcional)"
                    type="email"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                <button
                  onClick={() => setPersonas(personas.filter((_, i) => i !== idx))}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-4 py-2 rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Atras
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isEditMode
            ? (loading ? "Guardando cambios..." : "Guardar cambios")
            : (loading ? "Creando proyecto..." : "Crear proyecto")}
        </button>
      </div>
    </div>
  );
}
