"use client";

import { useState } from "react";
import {
  ArrowLeft, Building2, Calendar, ChevronDown, ChevronRight,
  Layers, Save, X,
} from "lucide-react";
import type {
  Contratista, TareaInput, EdificioInput, FaseAssignment, TorreAssignment,
} from "./wizard-types";

interface WizardStep3Props {
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  diasHabiles: number;
  edificios: EdificioInput[];
  fasesSeleccionadas: string[];
  tareas: TareaInput[];
  setTareas: React.Dispatch<React.SetStateAction<TareaInput[]>>;
  contratistas: Contratista[];
  totalUnidades: number;
  totalTareasGlobal: number;
  loading: boolean;
  onBack: () => void;
  onSubmit: (resolvedTareas?: TareaInput[]) => void;
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

export default function WizardStep3({
  nombre,
  subtipo,
  diasHabiles,
  edificios,
  fasesSeleccionadas,
  tareas,
  setTareas,
  contratistas,
  totalUnidades,
  totalTareasGlobal,
  loading,
  onBack,
  onSubmit,
}: WizardStep3Props) {
  const [assignments, setAssignments] = useState<FaseAssignment[]>(() =>
    buildInitialAssignments(fasesSeleccionadas, edificios)
  );

  // Compute all unique spaces from current tasks
  const allEspacios = [...new Set(tareas.map((t) => t.espacio))];

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

  // Resolve assignments to per-task asignado_a and call onSubmit directly
  function handleCreate() {
    const resolvedTareas = tareas.map((t) => {
      const faseAssign = assignments.find((a) => a.fase === t.fase);
      if (!faseAssign) return t;

      for (const [, torreAssign] of Object.entries(faseAssign.distribucion)) {
        if (torreAssign.desglosado && torreAssign.por_actividad[t.espacio] !== undefined) {
          return { ...t, asignado_a: torreAssign.por_actividad[t.espacio] ?? undefined };
        }
        if (torreAssign.contratista_global) {
          return { ...t, asignado_a: torreAssign.contratista_global };
        }
      }
      return t;
    });

    setTareas(resolvedTareas);
    onSubmit(resolvedTareas);
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

                {/* Distribution by tower */}
                {faseAssign.contratistas.length > 0 && subtipo !== "ZONAS_COMUNES" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">Distribucion:</label>
                    <div className="grid gap-3">
                      {edificios.map((edif) => {
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
                                  // Only show spaces that have tasks in this phase
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

                            <button
                              onClick={() => toggleDesglose(faseIdx, edif.nombre)}
                              className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                              {torreAssign.desglosado
                                ? <><ChevronDown className="w-3 h-3" /> Asignar todas a uno</>
                                : <><ChevronRight className="w-3 h-3" /> Desglosar por actividad</>
                              }
                            </button>
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
          {loading ? "Creando proyecto..." : "Crear proyecto"}
        </button>
      </div>
    </div>
  );
}
