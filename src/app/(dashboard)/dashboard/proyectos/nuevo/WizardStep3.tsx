"use client";

import { useState } from "react";
import {
  ArrowLeft, Building2, Calendar, Check, ChevronDown, ChevronRight,
  Layers, Plus, Save, Trash2, UserPlus, X,
} from "lucide-react";
import type {
  Contratista, TareaInput, TipoUnidadInput, EdificioInput,
  PersonaProyectoInput, AsignacionOverride,
} from "./wizard-types";
import { generateUnitNamesForTorre } from "./wizard-types";

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
  asignaciones: AsignacionOverride[];
  setAsignaciones: React.Dispatch<React.SetStateAction<AsignacionOverride[]>>;
  onBack: () => void;
  onSubmit: (resolvedTareas?: TareaInput[], overrides?: AsignacionOverride[]) => void;
}

interface TaskRow {
  key: string;
  nombre: string;
  espacio: string;
  subfase: string | null;
}

interface BuilderState {
  contratista: string;
  torres: string[];
  tipoUnidad: string;
  pisos: number[];
  aptos: string[];
  subfase: string;
  checked: Record<string, boolean>;
}

function buildTaskRows(tareas: TareaInput[], fase: string): TaskRow[] {
  const rows: TaskRow[] = [];
  const seen = new Set<string>();
  for (const t of tareas) {
    if (t.fase !== fase) continue;
    if (fase === "Madera") {
      const ik = `${t.espacio}|${t.nombre}::Instalación`;
      if (!seen.has(ik)) {
        seen.add(ik);
        rows.push({ key: `${t.nombre}::Instalación`, nombre: t.nombre, espacio: t.espacio, subfase: "Instalación" });
      }
      if (!t.lustro_excluido) {
        const lk = `${t.espacio}|${t.nombre}::Detallado y lustro`;
        if (!seen.has(lk)) {
          seen.add(lk);
          rows.push({ key: `${t.nombre}::Detallado y lustro`, nombre: t.nombre, espacio: t.espacio, subfase: "Detallado y lustro" });
        }
      }
    } else {
      const sfKey = t.subfase ? `${t.nombre}::${t.subfase}` : t.nombre;
      const uk = `${t.espacio}|${sfKey}`;
      if (!seen.has(uk)) {
        seen.add(uk);
        rows.push({ key: sfKey, nombre: t.nombre, espacio: t.espacio, subfase: t.subfase ?? null });
      }
    }
  }
  return rows;
}

function sfTag(sf: string | null): string {
  if (!sf) return "";
  if (sf === "Instalación") return " (Inst.)";
  if (sf === "Detallado y lustro") return " (Lustro)";
  return ` (${sf})`;
}

export default function WizardStep3({
  nombre, subtipo, diasHabiles, edificios, tiposUnidad,
  fasesSeleccionadas, tareas, contratistas, totalUnidades,
  totalTareasGlobal, loading, isEditMode, personas, setPersonas,
  asignaciones, setAsignaciones, onBack, onSubmit,
}: WizardStep3Props) {
  const [pool, setPool] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(fasesSeleccionadas.map(f => [f, []]))
  );

  const emptyBuilder: BuilderState = {
    contratista: "", torres: [], tipoUnidad: "", pisos: [], aptos: [], subfase: "", checked: {},
  };

  const [builders, setBuilders] = useState<Record<string, BuilderState>>(() =>
    Object.fromEntries(fasesSeleccionadas.map(f => [f, { ...emptyBuilder }]))
  );

  const [expanded, setExpanded] = useState<Record<string, Set<string>>>({});

  /* ── Pool ────────────────────────────────────────────── */

  function addToPool(fase: string, cId: string) {
    setPool(p => ({ ...p, [fase]: p[fase]?.includes(cId) ? p[fase] : [...(p[fase] ?? []), cId] }));
  }

  function removeFromPool(fase: string, cId: string) {
    setPool(p => ({ ...p, [fase]: (p[fase] ?? []).filter(id => id !== cId) }));
    setAsignaciones(p => p.filter(o => !(o.fase === fase && o.contratista_id === cId)));
    setBuilders(p => {
      const b = p[fase];
      if (b.contratista === cId) return { ...p, [fase]: { ...emptyBuilder } };
      return p;
    });
  }

  /* ── Builder helpers ─────────────────────────────────── */

  function updateBuilder(fase: string, partial: Partial<BuilderState>) {
    setBuilders(p => ({ ...p, [fase]: { ...p[fase], ...partial } }));
  }

  function getUnitsForTorres(torreNames: string[]) {
    return edificios
      .filter(e => torreNames.includes(e.nombre))
      .flatMap(e => generateUnitNamesForTorre(e, tiposUnidad).map(u => ({ ...u, torre: e.nombre })));
  }

  function toggleTorre(fase: string, torre: string) {
    setBuilders(p => {
      const b = p[fase];
      const newTorres = b.torres.includes(torre)
        ? b.torres.filter(t => t !== torre)
        : [...b.torres, torre];
      const units = getUnitsForTorres(newTorres);
      const availableTipos = new Set(units.map(u => u.tipo_unidad_id));
      const newTipo = b.tipoUnidad && availableTipos.has(b.tipoUnidad) ? b.tipoUnidad : "";
      const finalUnits = newTipo ? units.filter(u => u.tipo_unidad_id === newTipo) : units;
      const validFloors = new Set(finalUnits.map(u => u.piso));
      const newPisos = b.pisos.filter(pp => validFloors.has(pp));
      const validAptKeys = new Set(finalUnits.map(u => `${u.torre}::${u.nombre}`));
      const newAptos = b.aptos.filter(a => validAptKeys.has(a));
      return { ...p, [fase]: { ...b, torres: newTorres, tipoUnidad: newTipo, pisos: newPisos, aptos: newAptos } };
    });
  }

  function toggleTipoUnidad(fase: string, tipoId: string) {
    setBuilders(p => {
      const b = p[fase];
      const newTipo = b.tipoUnidad === tipoId ? "" : tipoId;
      const units = getUnitsForTorres(b.torres);
      const filtered = newTipo ? units.filter(u => u.tipo_unidad_id === newTipo) : units;
      const validFloors = new Set(filtered.map(u => u.piso));
      const newPisos = b.pisos.filter(pp => validFloors.has(pp));
      const validAptKeys = new Set(filtered.map(u => `${u.torre}::${u.nombre}`));
      const newAptos = b.aptos.filter(a => validAptKeys.has(a));
      return { ...p, [fase]: { ...b, tipoUnidad: newTipo, pisos: newPisos, aptos: newAptos } };
    });
  }

  function togglePiso(fase: string, piso: number) {
    setBuilders(p => {
      const b = p[fase];
      const newPisos = b.pisos.includes(piso)
        ? b.pisos.filter(pp => pp !== piso)
        : [...b.pisos, piso];
      const units = getUnitsForTorres(b.torres);
      const filtered = b.tipoUnidad ? units.filter(u => u.tipo_unidad_id === b.tipoUnidad) : units;
      const validAptKeys = new Set<string>();
      for (const u of filtered) {
        if (newPisos.length === 0 || newPisos.includes(u.piso)) {
          validAptKeys.add(`${u.torre}::${u.nombre}`);
        }
      }
      const newAptos = b.aptos.filter(a => validAptKeys.has(a));
      return { ...p, [fase]: { ...b, pisos: newPisos, aptos: newAptos } };
    });
  }

  function toggleApto(fase: string, aptoKey: string) {
    setBuilders(p => {
      const b = p[fase];
      const newAptos = b.aptos.includes(aptoKey)
        ? b.aptos.filter(a => a !== aptoKey)
        : [...b.aptos, aptoKey];
      return { ...p, [fase]: { ...b, aptos: newAptos } };
    });
  }

  function toggleTask(fase: string, key: string) {
    setBuilders(p => {
      const b = p[fase];
      return { ...p, [fase]: { ...b, checked: { ...b.checked, [key]: !b.checked[key] } } };
    });
  }

  function setAllTasks(fase: string, keys: string[], value: boolean) {
    setBuilders(p => {
      const b = p[fase];
      const checked = { ...b.checked };
      for (const k of keys) checked[k] = value;
      return { ...p, [fase]: { ...b, checked } };
    });
  }

  /* ── Accordion ───────────────────────────────────────── */

  function toggleExpanded(fase: string, cId: string) {
    setExpanded(prev => {
      const s = new Set(prev[fase] ?? []);
      if (s.has(cId)) s.delete(cId); else s.add(cId);
      return { ...prev, [fase]: s };
    });
  }

  /* ── Assign batch ────────────────────────────────────── */

  function handleAssign(fase: string) {
    const b = builders[fase];
    if (!b.contratista) return;
    const checkedKeys = Object.entries(b.checked).filter(([, v]) => v).map(([k]) => k);
    if (checkedKeys.length === 0) return;

    type Target = { torre?: string; unidad?: string };
    const targets: Target[] = [];

    if (b.aptos.length > 0) {
      for (const ak of b.aptos) {
        const [torre, unidad] = ak.split("::");
        targets.push({ torre, unidad });
      }
    } else if (b.pisos.length > 0 && b.torres.length > 0) {
      for (const tn of b.torres) {
        const edif = edificios.find(e => e.nombre === tn);
        if (!edif) continue;
        const units = generateUnitNamesForTorre(edif, tiposUnidad);
        const filtered = b.tipoUnidad ? units.filter(u => u.tipo_unidad_id === b.tipoUnidad) : units;
        for (const u of filtered) {
          if (b.pisos.includes(u.piso)) targets.push({ torre: tn, unidad: u.nombre });
        }
      }
    } else if (b.torres.length > 0) {
      if (b.tipoUnidad) {
        for (const tn of b.torres) {
          const edif = edificios.find(e => e.nombre === tn);
          if (!edif) continue;
          const units = generateUnitNamesForTorre(edif, tiposUnidad)
            .filter(u => u.tipo_unidad_id === b.tipoUnidad);
          for (const u of units) targets.push({ torre: tn, unidad: u.nombre });
        }
      } else {
        for (const tn of b.torres) targets.push({ torre: tn });
      }
    }

    setAsignaciones(prev => {
      let next = [...prev];
      for (const taskKey of checkedKeys) {
        if (targets.length === 0) {
          next = next.filter(o => !(o.fase === fase && o.tarea_nombre === taskKey && !o.torre && !o.unidad_nombre && !o.espacio));
          next.push({ fase, tarea_nombre: taskKey, contratista_id: b.contratista });
        } else {
          for (const t of targets) {
            next = next.filter(o => !(
              o.fase === fase && o.tarea_nombre === taskKey &&
              o.torre === t.torre &&
              (t.unidad ? o.unidad_nombre === t.unidad : !o.unidad_nombre) &&
              !o.espacio
            ));
            const ov: AsignacionOverride = { fase, torre: t.torre!, tarea_nombre: taskKey, contratista_id: b.contratista };
            if (t.unidad) ov.unidad_nombre = t.unidad;
            next.push(ov);
          }
        }
      }
      return next;
    });

    setBuilders(p => ({ ...p, [fase]: { ...emptyBuilder } }));
  }

  /* ── Delete overrides ────────────────────────────────── */

  function removeOverrideGroup(fase: string, contratistaId: string, taskKey: string) {
    setAsignaciones(prev => prev.filter(o => !(
      o.fase === fase && o.contratista_id === contratistaId && o.tarea_nombre === taskKey
    )));
  }

  function removeAllForContratista(fase: string, cId: string) {
    setAsignaciones(prev => prev.filter(o => !(o.fase === fase && o.contratista_id === cId)));
  }

  function handleCreate() {
    onSubmit(undefined, asignaciones);
  }

  /* ── Conflict check ──────────────────────────────────── */

  function getConflict(fase: string, taskKey: string, currentContratista: string, scope: BuilderState): string | null {
    const conflicting = asignaciones.find(o => {
      if (o.fase !== fase || o.tarea_nombre !== taskKey || o.contratista_id === currentContratista) return false;
      if (!o.torre) return true;
      if (scope.torres.length === 0) return true;
      if (!scope.torres.includes(o.torre)) return false;
      if (scope.aptos.length > 0 && o.unidad_nombre) {
        return scope.aptos.some(a => {
          const [t, u] = a.split("::");
          return t === o.torre && u === o.unidad_nombre;
        });
      }
      return true;
    });
    if (!conflicting) return null;
    return contratistas.find(c => c.id === conflicting.contratista_id)?.nombre ?? "otro";
  }

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Resumen del proyecto</h2>
      <p className="text-sm text-slate-500 mb-5">
        Revisa los detalles y asigna contratistas por fase, torre o apartamento
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
          {fasesSeleccionadas.map(fase => {
            const fasePool = pool[fase] ?? [];
            const b = builders[fase] ?? emptyBuilder;
            const taskRows = buildTaskRows(tareas, fase);
            const filteredBySubfase = b.subfase
              ? taskRows.filter(t => t.subfase === b.subfase)
              : taskRows;
            const subfases = [...new Set(taskRows.map(t => t.subfase).filter(Boolean))] as string[];
            const enabledTasks = b.contratista
              ? filteredBySubfase.filter(t => !getConflict(fase, t.key, b.contratista, b))
              : filteredBySubfase;
            const checkedCount = filteredBySubfase.filter(t => b.checked[t.key]).length;
            const selectedContratista = contratistas.find(c => c.id === b.contratista);

            const allSelectedUnits = getUnitsForTorres(b.torres);
            const tipoFilteredUnits = b.tipoUnidad
              ? allSelectedUnits.filter(u => u.tipo_unidad_id === b.tipoUnidad)
              : allSelectedUnits;
            const availableTipos = [...new Map(
              allSelectedUnits.map(u => {
                const t = tiposUnidad.find(tp => tp.id === u.tipo_unidad_id);
                return [u.tipo_unidad_id, t?.nombre ?? u.tipo_unidad_id] as [string, string];
              })
            )];
            const availableFloors = [...new Set(tipoFilteredUnits.map(u => u.piso))].sort((a, bb) => a - bb);
            const aptUnits = tipoFilteredUnits.filter(u =>
              b.pisos.length === 0 || b.pisos.includes(u.piso)
            );

            let scopeLabel = "Global — todas las torres y apartamentos";
            if (b.aptos.length > 0) {
              scopeLabel = `${b.aptos.length} apartamento${b.aptos.length > 1 ? "s" : ""} seleccionado${b.aptos.length > 1 ? "s" : ""}`;
            } else if (b.pisos.length > 0) {
              scopeLabel = `${b.torres.join(", ")} — Piso${b.pisos.length > 1 ? "s" : ""} ${b.pisos.sort((a, bb) => a - bb).join(", ")}`;
            } else if (b.torres.length > 0) {
              const tipoName = b.tipoUnidad ? tiposUnidad.find(t => t.id === b.tipoUnidad)?.nombre : null;
              scopeLabel = `${b.torres.join(", ")} — ${tipoName ? `solo ${tipoName}` : "todos los apartamentos"}`;
            }

            const faseOverrides = asignaciones.filter(o => o.fase === fase);
            const groupedByContratista = new Map<string, AsignacionOverride[]>();
            for (const o of faseOverrides) {
              if (!groupedByContratista.has(o.contratista_id)) groupedByContratista.set(o.contratista_id, []);
              groupedByContratista.get(o.contratista_id)!.push(o);
            }
            const faseExpanded = expanded[fase] ?? new Set<string>();

            return (
              <div key={fase} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">{fase}</h3>
                </div>
                <div className="p-4">
                  {/* Contratistas pool */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">Contratistas para esta fase:</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {fasePool.map(cId => {
                        const c = contratistas.find(x => x.id === cId);
                        if (!c) return null;
                        return (
                          <span key={cId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {c.nombre}
                            <button onClick={() => removeFromPool(fase, cId)} className="hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                    {contratistas.filter(c => !fasePool.includes(c.id)).length > 0 && (
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) addToPool(fase, e.target.value); e.target.value = ""; }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="" disabled>+ Agregar contratista</option>
                        {contratistas.filter(c => !fasePool.includes(c.id)).map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {fasePool.length > 0 ? (
                    <>
                      {/* ── Builder panel ── */}
                      <div className="border border-blue-200 rounded-lg bg-blue-50/30 p-3 mb-4">
                        <div className="text-xs font-semibold text-blue-800 mb-3">Nueva asignación</div>

                        {/* Contratista selector */}
                        <div className="mb-3">
                          <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Contratista:</label>
                          <select
                            value={b.contratista}
                            onChange={e => updateBuilder(fase, { contratista: e.target.value })}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white w-full sm:w-auto"
                          >
                            <option value="">Seleccionar contratista...</option>
                            {fasePool.map(cId => {
                              const c = contratistas.find(x => x.id === cId);
                              return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                            })}
                          </select>
                        </div>

                        {/* Multi-select torres */}
                        {subtipo !== "ZONAS_COMUNES" && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Torres:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {edificios.map(e => {
                                const sel = b.torres.includes(e.nombre);
                                return (
                                  <button
                                    key={e.nombre}
                                    onClick={() => toggleTorre(fase, e.nombre)}
                                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                      sel ? "bg-blue-100 border-blue-300 text-blue-800 font-medium" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                    }`}
                                  >
                                    {e.nombre}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Tipo de apartamento filter */}
                        {b.torres.length > 0 && availableTipos.length > 1 && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Tipo de apartamento:</label>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => { if (b.tipoUnidad) toggleTipoUnidad(fase, b.tipoUnidad); }}
                                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                  !b.tipoUnidad ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-medium" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                              >
                                Todos
                              </button>
                              {availableTipos.map(([id, name]) => {
                                const sel = b.tipoUnidad === id;
                                return (
                                  <button
                                    key={id}
                                    onClick={() => toggleTipoUnidad(fase, id)}
                                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                      sel ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-medium" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                    }`}
                                  >
                                    {name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Multi-select pisos */}
                        {b.torres.length > 0 && availableFloors.length > 0 && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Pisos:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {availableFloors.map(p => {
                                const sel = b.pisos.includes(p);
                                return (
                                  <button
                                    key={p}
                                    onClick={() => togglePiso(fase, p)}
                                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                                      sel ? "bg-blue-100 border-blue-300 text-blue-800 font-medium" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                    }`}
                                  >
                                    Piso {p}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Multi-select aptos */}
                        {b.torres.length > 0 && aptUnits.length > 0 && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Apartamentos:</label>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {aptUnits.map(u => {
                                const key = `${u.torre}::${u.nombre}`;
                                const sel = b.aptos.includes(key);
                                return (
                                  <button
                                    key={key}
                                    onClick={() => toggleApto(fase, key)}
                                    className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                                      sel ? "bg-blue-100 border-blue-300 text-blue-800 font-medium" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                                    }`}
                                  >
                                    {b.torres.length > 1 ? `${u.torre}-` : ""}{u.nombre}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Subfase filter */}
                        {subfases.length > 1 && (
                          <div className="mb-2">
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Subfase:</label>
                            <select
                              value={b.subfase}
                              onChange={e => updateBuilder(fase, { subfase: e.target.value })}
                              className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700"
                            >
                              <option value="">Todas</option>
                              {subfases.map(sf => <option key={sf} value={sf}>{sf}</option>)}
                            </select>
                          </div>
                        )}

                        {/* Scope label */}
                        {subtipo !== "ZONAS_COMUNES" && (
                          <div className="text-[10px] text-slate-500 mb-2">
                            Alcance: <span className="font-semibold text-slate-700">{scopeLabel}</span>
                          </div>
                        )}

                        {/* Task checkboxes */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-64 overflow-y-auto">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-200">
                            <span className="text-[10px] font-semibold text-slate-500">
                              {checkedCount}/{filteredBySubfase.length} seleccionadas
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAllTasks(fase, enabledTasks.map(t => t.key), true)}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Todas
                              </button>
                              <button
                                onClick={() => setAllTasks(fase, filteredBySubfase.map(t => t.key), false)}
                                className="text-[10px] text-slate-500 hover:text-slate-700 font-medium"
                              >
                                Ninguna
                              </button>
                            </div>
                          </div>
                          {filteredBySubfase.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-slate-400">No hay tareas para esta subfase</div>
                          ) : filteredBySubfase.map(task => {
                            const conflict = b.contratista ? getConflict(fase, task.key, b.contratista, b) : null;
                            const isDisabled = !!conflict;
                            const isChecked = !!b.checked[task.key];

                            return (
                              <div
                                key={`${task.espacio}|${task.key}`}
                                onClick={() => !isDisabled && toggleTask(fase, task.key)}
                                className={`flex items-center gap-2 px-3 py-1.5 border-b border-slate-50 last:border-b-0 select-none ${
                                  isDisabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : "hover:bg-blue-50/30 cursor-pointer"
                                }`}
                              >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isDisabled
                                    ? "bg-slate-100 border-slate-200"
                                    : isChecked
                                      ? "bg-blue-600 border-blue-600"
                                      : "bg-white border-slate-300"
                                }`}>
                                  {isChecked && !isDisabled && <Check className="w-3 h-3 text-white" />}
                                </span>
                                <span className={`text-[11px] truncate flex-1 ${isDisabled ? "text-slate-400" : "text-slate-700"}`}>
                                  {task.espacio} — {task.nombre}
                                  {task.subfase && (
                                    <span className="text-violet-500 ml-1 text-[10px]">{sfTag(task.subfase)}</span>
                                  )}
                                </span>
                                {conflict && (
                                  <span className="text-[10px] text-slate-400 italic flex-shrink-0">
                                    (asignada a {conflict})
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Asignar button */}
                        <button
                          onClick={() => handleAssign(fase)}
                          disabled={!b.contratista || checkedCount === 0}
                          className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
                        >
                          {b.contratista && checkedCount > 0
                            ? `Asignar ${checkedCount} tarea${checkedCount > 1 ? "s" : ""} a ${selectedContratista?.nombre}`
                            : "Selecciona contratista y tareas"}
                        </button>
                      </div>

                      {/* ── Accordion summary ── */}
                      {faseOverrides.length > 0 && (
                        <div className="space-y-1.5">
                          {Array.from(groupedByContratista.entries()).map(([cId, overrides]) => {
                            const c = contratistas.find(x => x.id === cId);
                            const isOpen = faseExpanded.has(cId);
                            const taskMap = new Map<string, AsignacionOverride[]>();
                            for (const o of overrides) {
                              const k = o.tarea_nombre ?? "__all__";
                              if (!taskMap.has(k)) taskMap.set(k, []);
                              taskMap.get(k)!.push(o);
                            }

                            return (
                              <div key={cId} className="border border-slate-100 rounded-lg overflow-hidden">
                                {/* Collapsed header */}
                                <div
                                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                  onClick={() => toggleExpanded(fase, cId)}
                                >
                                  {isOpen
                                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  }
                                  <span className="text-xs font-bold text-blue-800 flex-1">
                                    {c?.nombre ?? "?"} — {taskMap.size} tarea{taskMap.size > 1 ? "s" : ""}
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); removeAllForContratista(fase, cId); }}
                                    className="text-[10px] text-red-400 hover:text-red-600 font-medium flex items-center gap-0.5"
                                    title="Eliminar todas"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                  <div className="px-3 py-1.5 space-y-1">
                                    {Array.from(taskMap.entries()).map(([taskKey, ovs]) => {
                                      const parts = taskKey.split("::");
                                      const taskLabel = `${parts[0]}${sfTag(parts[1] ?? null)}`;

                                      let scope: string;
                                      if (ovs.length === 1 && !ovs[0].torre) {
                                        scope = "Global";
                                      } else if (ovs.every(o => !o.unidad_nombre)) {
                                        scope = ovs.map(o => o.torre).join(", ");
                                      } else {
                                        const byTorre = new Map<string, string[]>();
                                        for (const o of ovs) {
                                          const t = o.torre ?? "?";
                                          if (!byTorre.has(t)) byTorre.set(t, []);
                                          if (o.unidad_nombre) byTorre.get(t)!.push(o.unidad_nombre);
                                        }
                                        scope = Array.from(byTorre.entries())
                                          .map(([t, aptos]) => aptos.length > 0 ? `${t}: ${aptos.join(", ")}` : t)
                                          .join(" | ");
                                      }

                                      return (
                                        <div key={taskKey} className="flex items-center gap-2 text-[11px] text-slate-600 bg-white rounded px-2.5 py-1.5 border border-slate-100">
                                          <span className="flex-1 min-w-0 truncate">
                                            {taskLabel} — <span className="text-slate-400">{scope}</span>
                                          </span>
                                          <button
                                            onClick={() => removeOverrideGroup(fase, cId, taskKey)}
                                            className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5"
                                            title="Eliminar"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Agrega contratistas para asignarlos a las torres</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          No hay contratistas registrados. Puedes invitarlos despues desde Usuarios y asignarlos a las tareas.
        </div>
      )}

      {/* Personal vinculado */}
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
                    onChange={e => setPersonas(personas.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))}
                    placeholder="Nombre"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <input
                    value={p.cargo}
                    onChange={e => setPersonas(personas.map((x, i) => i === idx ? { ...x, cargo: e.target.value } : x))}
                    placeholder="Cargo (ej: Interventor)"
                    className="px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <input
                    value={p.email}
                    onChange={e => setPersonas(personas.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))}
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
