"use client";

import { useState } from "react";
import {
  ArrowLeft, Building2, Calendar,
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

/* ── Task row generation ───────────────────────────────── */

interface TaskRow {
  key: string;
  nombre: string;
  espacio: string;
  subfase: string | null;
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

/* ── Effective assignment resolution ───────────────────── */

function resolveEffective(
  overrides: AsignacionOverride[],
  fase: string,
  taskKey: string,
  torre: string | null,
  unidad: string | null,
): { contratista_id: string; direct: boolean } | null {
  const taskSubfase = taskKey.includes("::") ? taskKey.split("::")[1] : null;
  let directId: string | null = null;
  let bestScore = -1;
  let bestId: string | null = null;

  for (const o of overrides) {
    if (o.fase !== fase) continue;
    if (o.tarea_nombre != null && o.tarea_nombre !== taskKey) continue;
    if (o.subfase != null && o.subfase !== taskSubfase) continue;
    if (o.torre != null && !torre) continue;
    if (o.torre != null && o.torre !== torre) continue;
    if (o.unidad_nombre != null && !unidad) continue;
    if (o.unidad_nombre != null && o.unidad_nombre !== unidad) continue;
    if (o.espacio != null) continue;

    const isExact =
      o.tarea_nombre === taskKey &&
      (torre ? o.torre === torre : !o.torre) &&
      (unidad ? o.unidad_nombre === unidad : !o.unidad_nombre);

    if (isExact) {
      directId = o.contratista_id;
    } else {
      let score = 0;
      if (o.tarea_nombre) score += 32;
      if (o.subfase) score += 2;
      if (o.torre) score += 4;
      if (o.unidad_nombre) score += 8;
      if (score > bestScore) { bestScore = score; bestId = o.contratista_id; }
    }
  }

  if (directId) return { contratista_id: directId, direct: true };
  if (bestId) return { contratista_id: bestId, direct: false };
  return null;
}

type FloorResult = { contratista_id: string; direct: boolean } | { mixed: true } | null;

function resolveForFloor(
  overrides: AsignacionOverride[],
  fase: string,
  taskKey: string,
  torre: string,
  floorUnits: { nombre: string }[],
): FloorResult {
  if (floorUnits.length === 0) return null;
  const results = floorUnits.map(u => resolveEffective(overrides, fase, taskKey, torre, u.nombre));
  if (results.every(r => r === null)) return resolveEffective(overrides, fase, taskKey, torre, null);
  const firstId = results[0]?.contratista_id ?? null;
  if (!results.every(r => (r?.contratista_id ?? null) === firstId)) return { mixed: true };
  if (firstId) return { contratista_id: firstId, direct: results.every(r => r?.direct) };
  return null;
}

function isFloorMixed(r: FloorResult): r is { mixed: true } {
  return r != null && "mixed" in r;
}

/* ── Component ─────────────────────────────────────────── */

export default function WizardStep3({
  nombre, subtipo, diasHabiles, edificios, tiposUnidad,
  fasesSeleccionadas, tareas, contratistas, totalUnidades,
  totalTareasGlobal, loading, isEditMode, personas, setPersonas,
  asignaciones, setAsignaciones, onBack, onSubmit,
}: WizardStep3Props) {
  const [pool, setPool] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(fasesSeleccionadas.map(f => [f, []]))
  );

  const [filters, setFilters] = useState<Record<string, {
    torre: string; piso: string; apto: string; subfase: string;
  }>>(() =>
    Object.fromEntries(fasesSeleccionadas.map(f => [f, { torre: "", piso: "", apto: "", subfase: "" }]))
  );

  function addToPool(fase: string, cId: string) {
    setPool(p => ({ ...p, [fase]: p[fase]?.includes(cId) ? p[fase] : [...(p[fase] ?? []), cId] }));
  }

  function removeFromPool(fase: string, cId: string) {
    setPool(p => ({ ...p, [fase]: (p[fase] ?? []).filter(id => id !== cId) }));
    setAsignaciones(p => p.filter(o => !(o.fase === fase && o.contratista_id === cId)));
  }

  function updateFilter(fase: string, key: string, value: string) {
    setFilters(p => {
      const cur = p[fase] ?? { torre: "", piso: "", apto: "", subfase: "" };
      const nxt = { ...cur, [key]: value };
      if (key === "torre") { nxt.piso = ""; nxt.apto = ""; }
      if (key === "piso") { nxt.apto = ""; }
      return { ...p, [fase]: nxt };
    });
  }

  function assignAtScope(fase: string, taskKeys: string[], contratistaId: string | null) {
    const f = filters[fase] ?? { torre: "", piso: "", apto: "", subfase: "" };
    const torre = f.torre || null;
    const apto = f.apto || null;
    const isPisoScope = !!(f.piso && !apto && torre);

    setAsignaciones(prev => {
      let next = [...prev];
      for (const taskKey of taskKeys) {
        if (isPisoScope) {
          const edif = edificios.find(e => e.nombre === torre);
          if (!edif) continue;
          const floorUnits = generateUnitNamesForTorre(edif, tiposUnidad)
            .filter(u => u.piso === Number(f.piso));
          next = next.filter(o => !(
            o.fase === fase && o.torre === torre && o.tarea_nombre === taskKey &&
            !o.espacio && floorUnits.some(u => o.unidad_nombre === u.nombre)
          ));
          if (contratistaId) {
            for (const u of floorUnits) {
              next.push({ fase, torre: torre!, unidad_nombre: u.nombre, tarea_nombre: taskKey, contratista_id: contratistaId });
            }
          }
        } else {
          next = next.filter(o => !(
            o.fase === fase && o.tarea_nombre === taskKey &&
            (torre ? o.torre === torre : !o.torre) &&
            (apto ? o.unidad_nombre === apto : !o.unidad_nombre) &&
            !o.espacio
          ));
          if (contratistaId) {
            const ov: AsignacionOverride = { fase, tarea_nombre: taskKey, contratista_id: contratistaId };
            if (torre) ov.torre = torre;
            if (apto) ov.unidad_nombre = apto;
            next.push(ov);
          }
        }
      }
      return next;
    });
  }

  function handleCreate() {
    onSubmit(undefined, asignaciones);
  }

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
            const ff = filters[fase] ?? { torre: "", piso: "", apto: "", subfase: "" };
            const taskRows = buildTaskRows(tareas, fase);
            const visibleTasks = ff.subfase
              ? taskRows.filter(t => t.subfase === ff.subfase)
              : taskRows;
            const subfases = [...new Set(taskRows.map(t => t.subfase).filter(Boolean))] as string[];

            const edif = ff.torre ? edificios.find(e => e.nombre === ff.torre) : null;
            const allUnits = edif ? generateUnitNamesForTorre(edif, tiposUnidad) : [];
            const floors = [...new Set(allUnits.map(u => u.piso))].sort((a, b) => a - b);
            const aptOptions = ff.piso
              ? allUnits.filter(u => u.piso === Number(ff.piso))
              : allUnits;

            let scopeLabel = "Global — todas las torres y apartamentos";
            if (ff.apto) {
              scopeLabel = `${ff.torre}, Apto ${ff.apto}`;
            } else if (ff.piso) {
              const cnt = allUnits.filter(u => u.piso === Number(ff.piso)).length;
              scopeLabel = `${ff.torre}, Piso ${ff.piso} — ${cnt} apartamentos`;
            } else if (ff.torre) {
              scopeLabel = `${ff.torre} — todos los apartamentos`;
            }

            return (
              <div key={fase} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">{fase}</h3>
                </div>
                <div className="p-4">
                  {/* Contratistas pool */}
                  <div className="mb-4">
                    <label className="text-xs font-semibold text-slate-700 mb-2 block">
                      Contratistas para esta fase:
                    </label>
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
                      {/* Cascading filters */}
                      {subtipo !== "ZONAS_COMUNES" && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          <select
                            value={ff.torre}
                            onChange={e => updateFilter(fase, "torre", e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                          >
                            <option value="">Todas las torres</option>
                            {edificios.map(e => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
                          </select>
                          {ff.torre && floors.length > 0 && (
                            <select
                              value={ff.piso}
                              onChange={e => updateFilter(fase, "piso", e.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                            >
                              <option value="">Todos los pisos</option>
                              {floors.map(p => <option key={p} value={String(p)}>Piso {p}</option>)}
                            </select>
                          )}
                          {ff.torre && (
                            <select
                              value={ff.apto}
                              onChange={e => updateFilter(fase, "apto", e.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white"
                            >
                              <option value="">Todos los aptos</option>
                              {aptOptions.map(u => <option key={u.nombre} value={u.nombre}>Apto {u.nombre}</option>)}
                            </select>
                          )}
                          {subfases.length > 1 && (
                            <select
                              value={ff.subfase}
                              onChange={e => updateFilter(fase, "subfase", e.target.value)}
                              className="text-xs px-2 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700"
                            >
                              <option value="">Todas las subfases</option>
                              {subfases.map(sf => <option key={sf} value={sf}>{sf}</option>)}
                            </select>
                          )}
                        </div>
                      )}

                      {subtipo !== "ZONAS_COMUNES" && (
                        <div className="text-[10px] text-slate-500 mb-3">
                          Alcance: <span className="font-semibold text-slate-700">{scopeLabel}</span>
                        </div>
                      )}

                      {/* Bulk assign */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] text-slate-600">Asignar todas a:</span>
                        <select
                          defaultValue=""
                          onChange={e => {
                            const val = e.target.value;
                            if (!val) return;
                            assignAtScope(fase, visibleTasks.map(t => t.key), val === "__clear__" ? null : val);
                            e.target.value = "";
                          }}
                          className="text-[11px] px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-medium"
                        >
                          <option value="" disabled>Seleccionar...</option>
                          {fasePool.map(cId => {
                            const c = contratistas.find(x => x.id === cId);
                            return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                          })}
                          <option value="__clear__">Quitar asignación</option>
                        </select>
                      </div>

                      {/* Task list */}
                      <div className="border border-slate-100 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                        {visibleTasks.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-slate-400">
                            No hay tareas para esta subfase
                          </div>
                        ) : visibleTasks.map(task => {
                          const isPisoScope = !!(ff.piso && !ff.apto && ff.torre);
                          let eff: FloorResult;
                          if (isPisoScope) {
                            const floorUnits = allUnits.filter(u => u.piso === Number(ff.piso));
                            eff = resolveForFloor(asignaciones, fase, task.key, ff.torre, floorUnits);
                          } else {
                            eff = resolveEffective(asignaciones, fase, task.key, ff.torre || null, ff.apto || null);
                          }

                          const mixed = isFloorMixed(eff);
                          let effectiveId = "";
                          let direct = false;
                          if (eff && !isFloorMixed(eff)) {
                            effectiveId = eff.contratista_id;
                            direct = eff.direct;
                          }

                          return (
                            <div key={task.key} className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                mixed ? "bg-amber-400" :
                                effectiveId ? (direct ? "bg-blue-500" : "bg-blue-300") :
                                "bg-slate-200"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <span className={`text-[11px] truncate block ${!direct && effectiveId ? "text-slate-400 italic" : "text-slate-700"}`}>
                                  {task.espacio} — {task.nombre}
                                  {task.subfase && (
                                    <span className="text-violet-500 ml-1 text-[10px]">
                                      ({task.subfase === "Instalación" ? "Inst." : task.subfase === "Detallado y lustro" ? "Lustro" : task.subfase})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <select
                                value={mixed ? "__mixed__" : effectiveId}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === "__mixed__") return;
                                  assignAtScope(fase, [task.key], val || null);
                                }}
                                className={`text-[11px] px-1.5 py-0.5 rounded border max-w-[150px] ${
                                  mixed ? "border-amber-200 bg-amber-50 text-amber-700" :
                                  direct ? "border-blue-200 bg-blue-50" :
                                  effectiveId ? "border-slate-200 bg-slate-50 text-slate-400" :
                                  "border-slate-200 bg-white"
                                }`}
                              >
                                {mixed && <option value="__mixed__">Mixto</option>}
                                <option value="">Sin asignar</option>
                                {fasePool.map(cId => {
                                  const c = contratistas.find(x => x.id === cId);
                                  return c ? <option key={cId} value={cId}>{c.nombre}</option> : null;
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Directo
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-blue-300 inline-block" /> Heredado
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" /> Sin asignar
                        </span>
                        {subtipo !== "ZONAS_COMUNES" && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Mixto
                          </span>
                        )}
                      </div>
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
