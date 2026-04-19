"use client";

import { useState } from "react";
import {
  ArrowRight, Check, Plus, Ruler, Trash2, Trees,
} from "lucide-react";
import { ESPACIOS_SUGERIDOS, ZONAS_COMUNES_SUGERIDAS } from "@/lib/task-templates";
import type { TipoUnidadInput, EdificioInput } from "./wizard-types";

interface WizardStep1Props {
  nombre: string;
  setNombre: (v: string) => void;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  setSubtipo: (v: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES") => void;
  diasHabiles: number;
  setDiasHabiles: (v: number) => void;
  fechaInicio: string;
  setFechaInicio: (v: string) => void;
  fechaFin: string;
  setFechaFin: (v: string) => void;
  tiposUnidad: TipoUnidadInput[];
  setTiposUnidad: (v: TipoUnidadInput[]) => void;
  edificios: EdificioInput[];
  setEdificios: (v: EdificioInput[]) => void;
  tieneZonasComunes: boolean;
  setTieneZonasComunes: (v: boolean) => void;
  zonasSeleccionadas: string[];
  setZonasSeleccionadas: React.Dispatch<React.SetStateAction<string[]>>;
  metrosEnabled: boolean;
  onMetrosEnabledChange: (v: boolean) => void;
  metrosZonas: Record<string, number>;
  onMetrosZonasChange: (v: Record<string, number>) => void;
  canProceed: boolean;
  onNext: () => void;
}

export default function WizardStep1({
  nombre, setNombre,
  subtipo, setSubtipo,
  diasHabiles, setDiasHabiles,
  fechaInicio, setFechaInicio,
  fechaFin, setFechaFin,
  tiposUnidad, setTiposUnidad,
  edificios, setEdificios,
  tieneZonasComunes, setTieneZonasComunes,
  zonasSeleccionadas, setZonasSeleccionadas,
  metrosEnabled, onMetrosEnabledChange,
  metrosZonas, onMetrosZonasChange,
  canProceed, onNext,
}: WizardStep1Props) {
  // Custom space input per tipo (keyed by tipo.id)
  const [customSpaceInputs, setCustomSpaceInputs] = useState<Record<string, string>>({});
  // Zonas comunes custom input
  const [zonaPersonalizada, setZonaPersonalizada] = useState("");
  // String-based numeric inputs to allow empty field (keyed by "edificio-idx:field")
  const [numericStrings, setNumericStrings] = useState<Record<string, string>>({});

  // --- Tipo management ---
  function addTipoUnidad() {
    const newId = `t${Date.now()}`;
    const newTipo: TipoUnidadInput = { id: newId, nombre: `Tipo ${tiposUnidad.length + 1}`, espacios: [] };
    setTiposUnidad([...tiposUnidad, newTipo]);
    setEdificios(edificios.map((e) => ({ ...e, distribucion: { ...e.distribucion, [newId]: 0 } })));
  }

  function removeTipoUnidad(tipoId: string) {
    if (tiposUnidad.length <= 1) return;
    setTiposUnidad(tiposUnidad.filter((t) => t.id !== tipoId));
    setEdificios(edificios.map((e) => {
      const { [tipoId]: _, ...rest } = e.distribucion;
      return { ...e, distribucion: rest };
    }));
  }

  function updateTipoNombre(tipoId: string, nombre: string) {
    setTiposUnidad(tiposUnidad.map((t) => t.id === tipoId ? { ...t, nombre } : t));
  }

  function toggleTipoEspacio(tipoId: string, espacio: string) {
    setTiposUnidad(tiposUnidad.map((t) => {
      if (t.id !== tipoId) return t;
      return {
        ...t,
        espacios: t.espacios.includes(espacio)
          ? t.espacios.filter((e) => e !== espacio)
          : [...t.espacios, espacio],
      };
    }));
  }

  function addCustomSpace(tipoId: string) {
    const raw = customSpaceInputs[tipoId] ?? "";
    const trimmed = raw.trim();
    if (!trimmed) return;
    const tipo = tiposUnidad.find((t) => t.id === tipoId);
    if (!tipo) return;
    // Case-insensitive duplicate check
    if (tipo.espacios.some((e) => e.toLowerCase() === trimmed.toLowerCase())) return;
    setTiposUnidad(tiposUnidad.map((t) =>
      t.id === tipoId ? { ...t, espacios: [...t.espacios, trimmed] } : t
    ));
    setCustomSpaceInputs({ ...customSpaceInputs, [tipoId]: "" });
  }

  function removeCustomSpace(tipoId: string, espacio: string) {
    setTiposUnidad(tiposUnidad.map((t) =>
      t.id === tipoId ? { ...t, espacios: t.espacios.filter((e) => e !== espacio) } : t
    ));
  }

  // --- Metraje helpers ---
  function updateTipoMetrajeTotal(tipoId: string, value: number | undefined) {
    setTiposUnidad(tiposUnidad.map((t) =>
      t.id === tipoId ? { ...t, metraje_total: value } : t
    ));
  }

  function updateTipoMetrajeEspacio(tipoId: string, espacio: string, value: number | undefined) {
    setTiposUnidad(tiposUnidad.map((t) => {
      if (t.id !== tipoId) return t;
      const prev = t.metrajes_espacios ?? {};
      if (value === undefined) {
        const { [espacio]: _, ...rest } = prev;
        return { ...t, metrajes_espacios: rest };
      }
      return { ...t, metrajes_espacios: { ...prev, [espacio]: value } };
    }));
  }

  // --- Edificio management ---
  function addEdificio() {
    const dist: Record<string, number> = {};
    tiposUnidad.forEach((t) => { dist[t.id] = 2; });
    setEdificios([...edificios, { nombre: `Torre ${edificios.length + 1}`, pisos: 5, distribucion: dist }]);
  }

  function removeEdificio(idx: number) {
    setEdificios(edificios.filter((_, i) => i !== idx));
  }

  function updateEdificioNombre(idx: number, value: string) {
    const next = [...edificios];
    next[idx] = { ...next[idx], nombre: value };
    setEdificios(next);
  }

  // Numeric input helper: returns the display string and updates the real numeric state on valid input
  function getNumericDisplay(key: string, realValue: number): string {
    if (key in numericStrings) return numericStrings[key];
    return String(realValue);
  }

  function handleNumericChange(key: string, raw: string, applyValue: (n: number) => void) {
    // Allow empty string while typing
    if (raw === "") {
      setNumericStrings({ ...numericStrings, [key]: "" });
      return;
    }
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    const clamped = Math.max(0, n);
    // Clear the string override -- let the real value take over
    const next = { ...numericStrings };
    delete next[key];
    setNumericStrings(next);
    applyValue(clamped);
  }

  function handleNumericBlur(key: string, realValue: number) {
    // On blur, if the field is empty, reset display to the real value
    if (numericStrings[key] === "") {
      const next = { ...numericStrings };
      delete next[key];
      setNumericStrings(next);
    }
    // The real value stays as-is (it was never changed when field was empty)
    void realValue;
  }

  function updateEdificioPisos(idx: number, pisos: number) {
    const next = [...edificios];
    next[idx] = { ...next[idx], pisos };
    setEdificios(next);
  }

  function updateEdificioDistribucion(idx: number, tipoId: string, count: number) {
    const next = [...edificios];
    next[idx] = { ...next[idx], distribucion: { ...next[idx].distribucion, [tipoId]: count } };
    setEdificios(next);
  }

  // --- Zonas comunes ---
  function toggleZona(zona: string) {
    setZonasSeleccionadas((prev) =>
      prev.includes(zona) ? prev.filter((z) => z !== zona) : [...prev, zona]
    );
  }

  function agregarZonaPersonalizada() {
    const trimmed = zonaPersonalizada.trim();
    if (trimmed && !zonasSeleccionadas.includes(trimmed)) {
      setZonasSeleccionadas((prev) => [...prev, trimmed]);
    }
    setZonaPersonalizada("");
  }

  // --- Computed ---
  const totalUnidades = edificios.reduce((acc, e) => {
    const perFloor = Object.values(e.distribucion).reduce((s, n) => s + n, 0);
    return acc + e.pisos * perFloor;
  }, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-900 mb-5">Informacion del proyecto</h2>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Nombre del proyecto</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proyecto Olivo"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Subtipo</label>
          <select
            value={subtipo}
            onChange={(e) => {
              const val = e.target.value as "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
              setSubtipo(val);
              if (val === "ZONAS_COMUNES") setTieneZonasComunes(true);
            }}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
          >
            <option value="APARTAMENTOS">Apartamentos</option>
            <option value="CASAS">Casas</option>
            <option value="ZONAS_COMUNES">Solo zonas comunes</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Dias habiles/semana</label>
          <select
            value={diasHabiles}
            onChange={(e) => setDiasHabiles(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
          >
            <option value={5}>5 dias (lun-vie)</option>
            <option value={6}>6 dias (lun-sab)</option>
            <option value={7}>7 dias</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Fecha de inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Fecha fin estimada</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
      </div>

      {subtipo !== "ZONAS_COMUNES" && (
        <>
          {/* Tipos de unidad */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Tipos de unidad</h3>
              <button onClick={addTipoUnidad} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Agregar tipo
              </button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">Define los tipos de unidad y los espacios que tiene cada uno</p>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 ml-4">
                <Ruler className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-600">Incluir m²</span>
                <input
                  type="checkbox"
                  checked={metrosEnabled}
                  onChange={(e) => onMetrosEnabledChange(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="flex flex-col gap-4">
              {tiposUnidad.map((tipo) => (
                <div key={tipo.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={tipo.nombre}
                      onChange={(e) => updateTipoNombre(tipo.id, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                    {metrosEnabled && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="m² total"
                          value={tipo.metraje_total ?? ""}
                          onChange={(e) => updateTipoMetrajeTotal(tipo.id, e.target.value ? Number(e.target.value) : undefined)}
                          className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                        />
                        <span className="text-[10px] text-slate-400">m²</span>
                      </div>
                    )}
                    {tiposUnidad.length > 1 && (
                      <button onClick={() => removeTipoUnidad(tipo.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Suggested space chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {ESPACIOS_SUGERIDOS.map((esp) => (
                      <button
                        key={esp}
                        onClick={() => toggleTipoEspacio(tipo.id, esp)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          tipo.espacios.includes(esp)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {tipo.espacios.includes(esp) && <Check className="w-2.5 h-2.5 inline mr-0.5" />}
                        {esp}
                      </button>
                    ))}
                  </div>
                  {/* Custom space chips */}
                  {tipo.espacios.filter((e) => !ESPACIOS_SUGERIDOS.includes(e)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tipo.espacios.filter((e) => !ESPACIOS_SUGERIDOS.includes(e)).map((esp) => (
                        <span
                          key={esp}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-600 text-white border border-blue-600"
                        >
                          <Check className="w-2.5 h-2.5" />
                          {esp}
                          <button
                            type="button"
                            onClick={() => removeCustomSpace(tipo.id, esp)}
                            className="ml-0.5 hover:text-blue-200"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* m² per espacio */}
                  {metrosEnabled && tipo.espacios.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tipo.espacios.map((esp) => (
                        <div key={esp} className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500 truncate max-w-[80px]">{esp}:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="m²"
                            value={tipo.metrajes_espacios?.[esp] ?? ""}
                            onChange={(e) => updateTipoMetrajeEspacio(tipo.id, esp, e.target.value ? Number(e.target.value) : undefined)}
                            className="w-16 px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Custom space input */}
                  <div className="flex gap-2 mt-2">
                    <input
                      value={customSpaceInputs[tipo.id] ?? ""}
                      onChange={(e) => setCustomSpaceInputs({ ...customSpaceInputs, [tipo.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCustomSpace(tipo.id); }
                      }}
                      placeholder="Agregar espacio personalizado..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomSpace(tipo.id)}
                      disabled={!(customSpaceInputs[tipo.id] ?? "").trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {tipo.espacios.length === 0 && (
                    <p className="text-[11px] text-red-500 mt-1">Selecciona al menos un espacio</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Torres / Edificios */}
          <div className="border-t border-slate-100 pt-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Torres / Edificios</h3>
              <button onClick={addEdificio} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Agregar torre
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {edificios.map((e, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end mb-2">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
                      <input
                        value={e.nombre}
                        onChange={(ev) => updateEdificioNombre(idx, ev.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-xs text-slate-500 mb-1 block">Pisos</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getNumericDisplay(`e${idx}:pisos`, e.pisos)}
                        onChange={(ev) => handleNumericChange(`e${idx}:pisos`, ev.target.value, (n) => updateEdificioPisos(idx, Math.max(1, n)))}
                        onBlur={() => handleNumericBlur(`e${idx}:pisos`, e.pisos)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                      />
                    </div>
                    {edificios.length > 1 && (
                      <button
                        onClick={() => removeEdificio(idx)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tiposUnidad.map((tipo) => {
                      const distKey = `e${idx}:dist:${tipo.id}`;
                      return (
                        <div key={tipo.id} className="flex items-center gap-1.5">
                          <label className="text-xs text-slate-600">{tipo.nombre}:</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={getNumericDisplay(distKey, e.distribucion[tipo.id] ?? 0)}
                            onChange={(ev) => handleNumericChange(distKey, ev.target.value, (n) => updateEdificioDistribucion(idx, tipo.id, n))}
                            onBlur={() => handleNumericBlur(distKey, e.distribucion[tipo.id] ?? 0)}
                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                          <span className="text-[11px] text-slate-400">/piso</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Total: <strong>{totalUnidades}</strong> unidades en {edificios.length} torre{edificios.length !== 1 ? "s" : ""}
              {tiposUnidad.length > 1 && (
                <> ({tiposUnidad.map((t) => {
                  const count = edificios.reduce((acc, e) => acc + e.pisos * (e.distribucion[t.id] ?? 0), 0);
                  return `${count} ${t.nombre}`;
                }).join(", ")})</>
              )}
            </p>
          </div>
        </>
      )}

      {/* Zonas comunes */}
      <div className="border-t border-slate-100 pt-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trees className="w-4 h-4 text-green-600" />
            <h3 className="font-bold text-slate-800 text-sm">Zonas comunes</h3>
          </div>
          {subtipo !== "ZONAS_COMUNES" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tieneZonasComunes}
                onChange={(e) => {
                  setTieneZonasComunes(e.target.checked);
                  if (!e.target.checked) setZonasSeleccionadas([]);
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Este proyecto tiene zonas comunes</span>
            </label>
          )}
        </div>

        {tieneZonasComunes && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {ZONAS_COMUNES_SUGERIDAS.map((zona) => (
                <button
                  key={zona}
                  type="button"
                  onClick={() => toggleZona(zona)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    zonasSeleccionadas.includes(zona)
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {zonasSeleccionadas.includes(zona) && <Check className="w-3 h-3 inline mr-1" />}
                  {zona}
                </button>
              ))}
            </div>

            {/* Custom zonas already selected */}
            {zonasSeleccionadas.filter((z) => !ZONAS_COMUNES_SUGERIDAS.includes(z)).map((zona) => (
              <span
                key={zona}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-green-600 text-white border border-green-600 mr-2 mb-2"
              >
                <Check className="w-3 h-3" />
                {zona}
                <button
                  type="button"
                  onClick={() => setZonasSeleccionadas((prev) => prev.filter((z) => z !== zona))}
                  className="ml-1 hover:text-green-200"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Add custom zona */}
            <div className="flex gap-2 mt-2">
              <input
                value={zonaPersonalizada}
                onChange={(e) => setZonaPersonalizada(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarZonaPersonalizada(); } }}
                placeholder="Agregar otra zona..."
                className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
              />
              <button
                type="button"
                onClick={agregarZonaPersonalizada}
                disabled={!zonaPersonalizada.trim()}
                className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>

            {zonasSeleccionadas.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {zonasSeleccionadas.length} zona{zonasSeleccionadas.length !== 1 ? "s" : ""} seleccionada{zonasSeleccionadas.length !== 1 ? "s" : ""}
              </p>
            )}

            {/* m² per zona comun */}
            {metrosEnabled && zonasSeleccionadas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {zonasSeleccionadas.map((zona) => (
                  <div key={zona} className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-500 truncate max-w-[100px]">{zona}:</span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="m²"
                      value={metrosZonas[zona] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const next = { ...metrosZonas };
                        if (val === undefined) { delete next[zona]; } else { next[zona] = val; }
                        onMetrosZonasChange(next);
                      }}
                      className="w-16 px-1.5 py-1 rounded-lg border border-slate-200 text-[11px] text-center focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer"
        >
          Siguiente
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
