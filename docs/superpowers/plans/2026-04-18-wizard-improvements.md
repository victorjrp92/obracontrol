# Wizard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the project creation wizard with custom spaces, better numeric inputs, phase-based task sections with suggestions panel and Excel import/export, hierarchical contractor assignment, and removal of the legacy ExcelButtons component.

**Architecture:** Decompose the 849-line `wizard.tsx` monolith into focused sub-components (`WizardStep1.tsx`, `WizardStep2.tsx`, `WizardStep3.tsx`, `SuggestedTasksPanel.tsx`, `ExcelTemplateUtils.ts`). Each step component receives state and callbacks via props. ExcelJS is dynamically imported client-side to avoid bundle bloat. The API payload format stays unchanged -- the new hierarchical assignment in Step 3 resolves to per-task `asignado_a` before submission.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, ExcelJS 4.4.0 (client-side dynamic import), Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-04-18-wizard-improvements-design.md`

---

## File Structure

### Files to create:
```
src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep1.tsx    -- Step 1: project structure (custom spaces, numeric inputs)
src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep2.tsx    -- Step 2: tasks by phase (sections, manual add, list)
src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep3.tsx    -- Step 3: hierarchical assignment
src/app/(dashboard)/dashboard/proyectos/nuevo/SuggestedTasksPanel.tsx -- Checkbox panel for suggested tasks
src/app/(dashboard)/dashboard/proyectos/nuevo/ExcelTemplateUtils.ts  -- Client-side Excel generation and parsing
src/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types.ts   -- Shared types for all wizard components
```

### Files to modify:
```
src/lib/task-templates.ts                                       -- Rename "Zona de labores" -> "Zona de lavado"
src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx        -- Slim down to orchestrator, delegate to sub-components
src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx           -- Remove ExcelButtons import and usage
```

### Files to delete:
```
src/app/(dashboard)/dashboard/proyectos/[id]/ExcelButtons.tsx   -- No longer needed
```

### Files unchanged (kept for future use per spec):
```
src/app/api/proyectos/[id]/plantilla/route.ts                  -- Keep API route, just not exposed in UI
src/app/api/proyectos/[id]/importar-tareas/route.ts            -- Keep API route, just not exposed in UI
```

---

## Task 1: Rename "Zona de labores" to "Zona de lavado" in task-templates.ts

**Files:**
- Modify: `src/lib/task-templates.ts`

- [ ] **Step 1: Rename in ESPACIOS_SUGERIDOS**

In `src/lib/task-templates.ts`, change line 21:

```typescript
// Before:
  "Zona de labores",

// After:
  "Zona de lavado",
```

- [ ] **Step 2: Rename the key and task names in TASK_TEMPLATES["Obra Blanca"]**

In `src/lib/task-templates.ts`, replace the "Zona de labores" entry in "Obra Blanca" (lines 77-80):

```typescript
// Before:
    "Zona de labores": [
      { nombre: "Estuco zona de labores", tiempo_acordado_dias: 1 },
      { nombre: "Pintura zona de labores", tiempo_acordado_dias: 1 },
    ],

// After:
    "Zona de lavado": [
      { nombre: "Estuco zona de lavado", tiempo_acordado_dias: 1 },
      { nombre: "Pintura zona de lavado", tiempo_acordado_dias: 1 },
    ],
```

- [ ] **Step 3: Rename the key and task name in TASK_TEMPLATES["Madera"]**

In `src/lib/task-templates.ts`, replace the "Zona de labores" entry in "Madera" (lines 137-139):

```typescript
// Before:
    "Zona de labores": [
      { nombre: "Mueble zona de labores", tiempo_acordado_dias: 2 },
    ],

// After:
    "Zona de lavado": [
      { nombre: "Mueble zona de lavado", tiempo_acordado_dias: 2 },
    ],
```

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npx next build 2>&1 | tail -5
```
Expected: Build succeeds (or only pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-templates.ts
git commit -m "rename: Zona de labores -> Zona de lavado in task templates"
```

---

## Task 2: Extract shared wizard types into wizard-types.ts

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types.ts`

- [ ] **Step 1: Create the shared types file**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types.ts`:

```typescript
export interface Contratista {
  id: string;
  nombre: string;
  rol_ref: { nombre: string };
}

export interface TipoUnidadInput {
  id: string;
  nombre: string;
  espacios: string[];
}

export interface EdificioInput {
  nombre: string;
  pisos: number;
  distribucion: Record<string, number>; // tipo.id -> count per floor
}

export interface TareaInput {
  id: string; // local id
  fase: string;
  espacio: string;
  nombre: string;
  tiempo_acordado_dias: number;
  codigo_referencia?: string;
  marca_linea?: string;
  componentes?: string;
  asignado_a?: string;
}

export interface TorreAssignment {
  contratista_global: string | null;
  desglosado: boolean;
  por_actividad: Record<string, string | null>; // espacio -> contratista ID
}

export interface FaseAssignment {
  fase: string;
  contratistas: string[]; // IDs of contratistas assigned to this phase
  distribucion: Record<string, TorreAssignment>; // edificio nombre -> assignment
}

export const FASES_DISPONIBLES = ["Madera", "Obra Blanca"];
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/wizard-types.ts
git commit -m "feat: extract shared wizard types into wizard-types.ts"
```

---

## Task 3: Build WizardStep1 component (custom spaces + numeric input fix)

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep1.tsx`

This component handles all of Step 1: project info, unit types with custom spaces, buildings with fixed numeric inputs, and common areas. It receives all Step 1 state and setters as props.

- [ ] **Step 1: Create WizardStep1.tsx**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep1.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  ArrowRight, Check, Plus, Trash2, Trees,
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
            <p className="text-xs text-slate-500 mb-3">Define los tipos de unidad y los espacios que tiene cada uno</p>

            <div className="flex flex-col gap-4">
              {tiposUnidad.map((tipo) => (
                <div key={tipo.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={tipo.nombre}
                      onChange={(e) => updateTipoNombre(tipo.id, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npx tsc --noEmit --pretty 2>&1 | grep -c "error" || echo "0 errors"
```
Expected: 0 errors (or only pre-existing ones).

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/WizardStep1.tsx
git commit -m "feat: WizardStep1 component with custom spaces and fixed numeric inputs"
```

---

## Task 4: Build SuggestedTasksPanel component

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/SuggestedTasksPanel.tsx`

This component shows a checkbox panel of suggested tasks grouped by space for a single phase. The user selects tasks and clicks "Agregar seleccionadas" to add them.

- [ ] **Step 1: Create SuggestedTasksPanel.tsx**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/SuggestedTasksPanel.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Check, X } from "lucide-react";
import { getTareasSugeridas } from "@/lib/task-templates";
import type { TaskTemplate } from "@/lib/task-templates";
import type { TareaInput } from "./wizard-types";

interface SuggestedTask extends TaskTemplate {
  espacio: string;
}

interface SuggestedTasksPanelProps {
  fase: string;
  espacios: string[];
  existingTareas: TareaInput[]; // current tasks for this phase (to detect duplicates)
  onAdd: (tareas: Omit<TareaInput, "id">[]) => void;
  onClose: () => void;
}

export default function SuggestedTasksPanel({
  fase,
  espacios,
  existingTareas,
  onAdd,
  onClose,
}: SuggestedTasksPanelProps) {
  // Build grouped suggestions
  const grouped = useMemo(() => {
    const result: { espacio: string; tareas: SuggestedTask[] }[] = [];
    for (const espacio of espacios) {
      const templates = getTareasSugeridas(fase, espacio);
      if (templates.length > 0) {
        result.push({
          espacio,
          tareas: templates.map((t) => ({ ...t, espacio })),
        });
      }
    }
    return result;
  }, [fase, espacios]);

  const allSuggestions = useMemo(() => grouped.flatMap((g) => g.tareas), [grouped]);

  // Track selected by a composite key "espacio::nombre"
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select all that are not already in existingTareas
    const keys = new Set<string>();
    for (const s of allSuggestions) {
      const key = `${s.espacio}::${s.nombre}`;
      const alreadyExists = existingTareas.some(
        (t) => t.fase === fase && t.espacio === s.espacio && t.nombre === s.nombre
      );
      if (!alreadyExists) {
        keys.add(key);
      }
    }
    return keys;
  });

  function toggleTask(espacio: string, nombre: string) {
    const key = `${espacio}::${nombre}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleEspacio(espacio: string, tareas: SuggestedTask[]) {
    const keys = tareas.map((t) => `${t.espacio}::${t.nombre}`);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        keys.forEach((k) => next.delete(k));
      } else {
        keys.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  function toggleAll() {
    const allKeys = allSuggestions.map((s) => `${s.espacio}::${s.nombre}`);
    const allSelected = allKeys.every((k) => selected.has(k));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allKeys));
    }
  }

  function handleConfirm() {
    const tareasToAdd: Omit<TareaInput, "id">[] = [];
    for (const s of allSuggestions) {
      const key = `${s.espacio}::${s.nombre}`;
      if (!selected.has(key)) continue;
      // Skip duplicates
      const alreadyExists = existingTareas.some(
        (t) => t.fase === fase && t.espacio === s.espacio && t.nombre === s.nombre
      );
      if (alreadyExists) continue;
      tareasToAdd.push({
        fase,
        espacio: s.espacio,
        nombre: s.nombre,
        tiempo_acordado_dias: s.tiempo_acordado_dias,
        codigo_referencia: s.codigo_referencia,
        marca_linea: s.marca_linea,
        componentes: s.componentes,
      });
    }
    onAdd(tareasToAdd);
    onClose();
  }

  if (allSuggestions.length === 0) {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-violet-700">No hay tareas sugeridas para los espacios de esta fase.</p>
        <button onClick={onClose} className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-medium">Cerrar</button>
      </div>
    );
  }

  const selectedCount = selected.size;
  const allKeys = allSuggestions.map((s) => `${s.espacio}::${s.nombre}`);
  const allChecked = allKeys.every((k) => selected.has(k));

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800">Tareas sugeridas - {fase}</h4>
        <button onClick={onClose} className="p-1 rounded hover:bg-violet-100 text-slate-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Global select all */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="text-xs font-semibold text-slate-700">Seleccionar todo ({allSuggestions.length} tareas)</span>
      </label>

      <div className="max-h-72 overflow-y-auto space-y-3">
        {grouped.map(({ espacio, tareas }) => {
          const espacioKeys = tareas.map((t) => `${t.espacio}::${t.nombre}`);
          const allEspacioSelected = espacioKeys.every((k) => selected.has(k));
          return (
            <div key={espacio}>
              {/* Espacio header with select-all for this space */}
              <label className="flex items-center gap-2 mb-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allEspacioSelected}
                  onChange={() => toggleEspacio(espacio, tareas)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs font-bold text-slate-700">{espacio}</span>
              </label>
              <div className="pl-6 space-y-1">
                {tareas.map((t) => {
                  const key = `${t.espacio}::${t.nombre}`;
                  const isSelected = selected.has(key);
                  const isDuplicate = existingTareas.some(
                    (ex) => ex.fase === fase && ex.espacio === t.espacio && ex.nombre === t.nombre
                  );
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2 cursor-pointer ${isDuplicate ? "opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTask(t.espacio, t.nombre)}
                        disabled={isDuplicate}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xs text-slate-700 flex-1">{t.nombre}</span>
                      <span className="text-[10px] text-slate-400">{t.tiempo_acordado_dias}d</span>
                      {isDuplicate && <span className="text-[10px] text-amber-600">ya existe</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-violet-200">
        <button
          onClick={onClose}
          className="text-xs text-slate-600 hover:text-slate-800 font-medium px-3 py-1.5"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          Agregar {selectedCount} seleccionada{selectedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/SuggestedTasksPanel.tsx
git commit -m "feat: SuggestedTasksPanel with checkboxes grouped by space"
```

---

## Task 5: Build ExcelTemplateUtils (client-side Excel generation and parsing)

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/ExcelTemplateUtils.ts`

This module generates and parses Excel files client-side with ExcelJS (dynamic import). It provides two functions: `generatePhaseTemplate` and `parsePhaseTemplate`.

- [ ] **Step 1: Create ExcelTemplateUtils.ts**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/ExcelTemplateUtils.ts`:

```typescript
import type { TareaInput } from "./wizard-types";

/**
 * Generate an .xlsx template for a specific phase.
 * ExcelJS is dynamically imported to avoid bundle bloat.
 */
export async function generatePhaseTemplate(
  fase: string,
  espacios: string[],
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Seiricon";

  // --- Sheet 1: Tareas ---
  const ws = wb.addWorksheet("Tareas");

  ws.columns = [
    { header: "Espacio", key: "espacio", width: 22 },
    { header: "Nombre de la tarea", key: "nombre", width: 35 },
    { header: "Dias acordados", key: "dias", width: 15 },
    { header: "Codigo referencia (opcional)", key: "codigo", width: 25 },
    { header: "Marca/Linea (opcional)", key: "marca", width: 20 },
    { header: "Componentes (opcional)", key: "componentes", width: 25 },
    { header: "Notas (opcional)", key: "notas", width: 30 },
  ];

  // Style header row
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { horizontal: "center" };
  });

  // 3 example rows
  const examples = [
    { espacio: espacios[0] ?? "Cocina", nombre: "[EJEMPLO] Instalar meson de cocina", dias: 3, codigo: "MK01", marca: "SAGANO", componentes: "estructura + cubierta", notas: "" },
    { espacio: espacios[1] ?? "Bano principal", nombre: "[EJEMPLO] Instalar mueble lavamanos", dias: 2, codigo: "", marca: "", componentes: "", notas: "Verificar plomeria" },
    { espacio: espacios[0] ?? "Cocina", nombre: "[EJEMPLO] Pintura paredes cocina", dias: 1, codigo: "", marca: "", componentes: "", notas: "" },
  ];

  for (const ex of examples) {
    const row = ws.addRow({
      espacio: ex.espacio,
      nombre: ex.nombre,
      dias: ex.dias,
      codigo: ex.codigo,
      marca: ex.marca,
      componentes: ex.componentes,
      notas: ex.notas,
    });
    row.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: "FF94A3B8" } };
    });
  }

  // Data validation for "Espacio" column (rows 2-200)
  if (espacios.length > 0) {
    for (let r = 2; r <= 200; r++) {
      ws.getCell(`A${r}`).dataValidation = {
        type: "list",
        formulae: [`"${espacios.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Espacio invalido",
        error: "Selecciona un espacio de la lista",
      };
    }
  }

  // --- Sheet 2: Instrucciones ---
  const instrWs = wb.addWorksheet("Instrucciones");
  instrWs.getColumn(1).width = 60;

  const instrucciones = [
    `Plantilla de tareas - Fase: ${fase}`,
    "",
    "Como llenar esta plantilla:",
    "1. En la hoja 'Tareas', cada fila es una tarea.",
    "2. 'Espacio' es obligatorio: selecciona del dropdown (o escribe exacto).",
    "3. 'Nombre de la tarea' es obligatorio.",
    "4. 'Dias acordados' es obligatorio y debe ser mayor a 0.",
    "5. Las columnas 'Codigo referencia', 'Marca/Linea', 'Componentes' y 'Notas' son opcionales.",
    "",
    "Espacios validos:",
    ...espacios.map((e) => `  - ${e}`),
    "",
    "NOTA: Las filas que empiecen con [EJEMPLO] seran ignoradas al importar.",
  ];

  instrucciones.forEach((line, i) => {
    const cell = instrWs.getCell(`A${i + 1}`);
    cell.value = line;
    if (i === 0) {
      cell.font = { bold: true, size: 14, color: { argb: "FF2563EB" } };
    } else if (line.startsWith("Como llenar") || line.startsWith("Espacios validos") || line.startsWith("NOTA:")) {
      cell.font = { bold: true };
    }
  });

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla-${fase.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded .xlsx template for a specific phase.
 * Returns { tareas, errores }.
 */
export async function parsePhaseTemplate(
  file: File,
  fase: string,
  validEspacios: string[],
): Promise<{ tareas: Omit<TareaInput, "id">[]; errores: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const ws = wb.getWorksheet("Tareas");
  if (!ws) {
    return { tareas: [], errores: ["La hoja 'Tareas' no existe en el archivo"] };
  }

  const errores: string[] = [];
  const tareas: Omit<TareaInput, "id">[] = [];
  const validEspaciosLower = validEspacios.map((e) => e.toLowerCase());

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const espacio = String(row.getCell(1).value ?? "").trim();
    const nombre = String(row.getCell(2).value ?? "").trim();
    const dias = Number(row.getCell(3).value);
    const codigo = String(row.getCell(4).value ?? "").trim() || undefined;
    const marca = String(row.getCell(5).value ?? "").trim() || undefined;
    const componentes = String(row.getCell(6).value ?? "").trim() || undefined;

    // Skip empty rows
    if (!espacio && !nombre) return;

    // Skip example rows
    if (nombre.startsWith("[EJEMPLO]")) return;

    // Validate espacio
    if (!espacio) {
      errores.push(`Fila ${rowNumber}: falta el espacio`);
      return;
    }
    if (!validEspaciosLower.includes(espacio.toLowerCase())) {
      errores.push(`Fila ${rowNumber}: espacio "${espacio}" no existe en los tipos definidos`);
      return;
    }

    // Validate nombre
    if (!nombre) {
      errores.push(`Fila ${rowNumber}: falta el nombre de la tarea`);
      return;
    }

    // Validate dias
    if (!dias || dias < 1) {
      errores.push(`Fila ${rowNumber}: dias acordados debe ser mayor a 0`);
      return;
    }

    // Normalize espacio casing to match the valid list
    const matchedEspacio = validEspacios.find((e) => e.toLowerCase() === espacio.toLowerCase()) ?? espacio;

    tareas.push({
      fase,
      espacio: matchedEspacio,
      nombre,
      tiempo_acordado_dias: dias,
      codigo_referencia: codigo,
      marca_linea: marca,
      componentes,
    });
  });

  return { tareas, errores };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/ExcelTemplateUtils.ts
git commit -m "feat: ExcelTemplateUtils for client-side Excel generation and parsing"
```

---

## Task 6: Build WizardStep2 component (tasks by phase with sections)

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep2.tsx`

This component handles Step 2: phase selection, phase sections (each with its own "Generar sugeridas", "Agregar manual", Excel download/upload, and task list). It imports `SuggestedTasksPanel` and `ExcelTemplateUtils`.

- [ ] **Step 1: Create WizardStep2.tsx**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep2.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight,
  Download, Plus, Sparkles, Trash2, Upload,
} from "lucide-react";
import type { TareaInput } from "./wizard-types";
import { FASES_DISPONIBLES } from "./wizard-types";
import SuggestedTasksPanel from "./SuggestedTasksPanel";
import { generatePhaseTemplate, parsePhaseTemplate } from "./ExcelTemplateUtils";

interface WizardStep2Props {
  allEspacios: string[];
  fasesSeleccionadas: string[];
  setFasesSeleccionadas: React.Dispatch<React.SetStateAction<string[]>>;
  tareas: TareaInput[];
  setTareas: React.Dispatch<React.SetStateAction<TareaInput[]>>;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
}

export default function WizardStep2({
  allEspacios,
  fasesSeleccionadas,
  setFasesSeleccionadas,
  tareas,
  setTareas,
  canProceed,
  onNext,
  onBack,
}: WizardStep2Props) {
  // Collapsed state per fase
  const [collapsedFases, setCollapsedFases] = useState<Record<string, boolean>>({});
  // Which fase has the suggestions panel open
  const [suggestionsOpenFase, setSuggestionsOpenFase] = useState<string | null>(null);
  // Which fase has the manual add form open
  const [addFormOpenFase, setAddFormOpenFase] = useState<string | null>(null);
  // Manual add form state
  const [newTaskEspacio, setNewTaskEspacio] = useState("");
  const [newTaskNombre, setNewTaskNombre] = useState("");
  const [newTaskDias, setNewTaskDias] = useState(3);
  // Excel upload state per fase
  const [excelErrors, setExcelErrors] = useState<Record<string, string[]>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function toggleFase(fase: string) {
    setFasesSeleccionadas((prev) =>
      prev.includes(fase) ? prev.filter((f) => f !== fase) : [...prev, fase]
    );
  }

  function toggleCollapse(fase: string) {
    setCollapsedFases((prev) => ({ ...prev, [fase]: !prev[fase] }));
  }

  function removeTarea(id: string) {
    setTareas((prev) => prev.filter((t) => t.id !== id));
  }

  function addSuggestedTareas(fase: string, nuevas: Omit<TareaInput, "id">[]) {
    let counter = Date.now();
    const withIds: TareaInput[] = nuevas.map((t) => ({
      ...t,
      id: `sug-${counter++}`,
    }));
    setTareas((prev) => [...prev, ...withIds]);
  }

  function openAddForm(fase: string) {
    setAddFormOpenFase(fase);
    if (allEspacios.length > 0) setNewTaskEspacio(allEspacios[0]);
    setNewTaskNombre("");
    setNewTaskDias(3);
  }

  function addCustomTask(fase: string) {
    if (!newTaskEspacio || !newTaskNombre.trim()) return;
    const id = `custom-${Date.now()}`;
    setTareas((prev) => [...prev, {
      id,
      fase,
      espacio: newTaskEspacio,
      nombre: newTaskNombre.trim(),
      tiempo_acordado_dias: newTaskDias,
    }]);
    setNewTaskNombre("");
    setNewTaskDias(3);
  }

  async function handleExcelDownload(fase: string) {
    await generatePhaseTemplate(fase, allEspacios);
  }

  async function handleExcelUpload(fase: string, file: File) {
    setUploading((prev) => ({ ...prev, [fase]: true }));
    setExcelErrors((prev) => ({ ...prev, [fase]: [] }));

    const result = await parsePhaseTemplate(file, fase, allEspacios);

    if (result.errores.length > 0) {
      setExcelErrors((prev) => ({ ...prev, [fase]: result.errores }));
    }

    if (result.tareas.length > 0) {
      let counter = Date.now();
      const withIds: TareaInput[] = result.tareas.map((t) => ({
        ...t,
        id: `excel-${counter++}`,
      }));
      setTareas((prev) => [...prev, ...withIds]);
    }

    setUploading((prev) => ({ ...prev, [fase]: false }));
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Fases y tareas</h2>
      <p className="text-xs text-slate-500 mb-5">
        Espacios definidos por tipo: {allEspacios.join(", ") || "\u2014"}
      </p>

      {/* Fases chips */}
      <div className="mb-6">
        <h3 className="font-bold text-slate-800 text-sm mb-3">Fases del proyecto</h3>
        <div className="flex flex-wrap gap-2">
          {FASES_DISPONIBLES.map((fase) => (
            <button
              key={fase}
              onClick={() => toggleFase(fase)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                fasesSeleccionadas.includes(fase)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {fasesSeleccionadas.includes(fase) && <Check className="w-3 h-3 inline mr-1" />}
              {fase}
            </button>
          ))}
        </div>
      </div>

      {/* Phase sections */}
      {fasesSeleccionadas.map((fase) => {
        const faseTareas = tareas.filter((t) => t.fase === fase);
        const isCollapsed = collapsedFases[fase] ?? false;

        return (
          <div key={fase} className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            {/* Phase header */}
            <button
              onClick={() => toggleCollapse(fase)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-slate-500" />
                  : <ChevronDown className="w-4 h-4 text-slate-500" />
                }
                <span className="text-sm font-bold text-slate-800">{fase}</span>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {faseTareas.length} tarea{faseTareas.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>

            {!isCollapsed && (
              <div className="p-4">
                {/* Action buttons */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <button
                    onClick={() => setSuggestionsOpenFase(suggestionsOpenFase === fase ? null : fase)}
                    className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generar sugeridas
                  </button>
                  <button
                    onClick={() => openAddForm(addFormOpenFase === fase ? "" : fase)}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar manual
                  </button>
                  <button
                    onClick={() => handleExcelDownload(fase)}
                    className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 hover:border-slate-300 font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar plantilla
                  </button>
                  <button
                    onClick={() => fileInputRefs.current[fase]?.click()}
                    disabled={uploading[fase]}
                    className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading[fase] ? "Importando..." : "Subir plantilla"}
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[fase] = el; }}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleExcelUpload(fase, file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Excel upload errors */}
                {excelErrors[fase] && excelErrors[fase].length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
                    <p className="font-semibold mb-1">Errores al importar:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {excelErrors[fase].slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {excelErrors[fase].length > 5 && (
                        <li>...y {excelErrors[fase].length - 5} errores mas</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Suggestions panel */}
                {suggestionsOpenFase === fase && (
                  <SuggestedTasksPanel
                    fase={fase}
                    espacios={allEspacios}
                    existingTareas={tareas}
                    onAdd={(nuevas) => addSuggestedTareas(fase, nuevas)}
                    onClose={() => setSuggestionsOpenFase(null)}
                  />
                )}

                {/* Manual add form */}
                {addFormOpenFase === fase && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Nueva tarea - {fase}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Espacio</label>
                        <select
                          value={newTaskEspacio}
                          onChange={(e) => setNewTaskEspacio(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                        >
                          {allEspacios.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Nombre de la tarea</label>
                        <input
                          value={newTaskNombre}
                          onChange={(e) => setNewTaskNombre(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTask(fase); } }}
                          placeholder="Ej: Instalar meson"
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Dias</label>
                        <input
                          type="number"
                          min="1"
                          value={newTaskDias}
                          onChange={(e) => setNewTaskDias(Number(e.target.value) || 1)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => addCustomTask(fase)}
                      disabled={!newTaskEspacio || !newTaskNombre.trim()}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>
                )}

                {/* Task list for this phase */}
                {faseTareas.length > 0 && (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-100">
                      {faseTareas.length} tarea{faseTareas.length !== 1 ? "s" : ""} en {fase}
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {faseTareas.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50/50">
                          <span className="text-[10px] text-slate-500 w-28 truncate flex-shrink-0">{t.espacio}</span>
                          <span className="text-sm font-medium text-slate-800 flex-1 truncate">{t.nombre}</span>
                          <span className="text-xs text-slate-500 flex-shrink-0">{t.tiempo_acordado_dias}d</span>
                          <button onClick={() => removeTarea(t.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {faseTareas.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No hay tareas en esta fase. Genera sugeridas, agrega manualmente o sube una plantilla Excel.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-4 py-2 rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Atras
        </button>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/WizardStep2.tsx
git commit -m "feat: WizardStep2 with phase sections, suggestions, manual add, and Excel import/export"
```

---

## Task 7: Build WizardStep3 component (hierarchical assignment)

**Files:**
- Create: `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep3.tsx`

This component handles Step 3: summary cards (unchanged), hierarchical assignment by phase -> tower -> optionally by activity, and the "Crear proyecto" button.

- [ ] **Step 1: Create WizardStep3.tsx**

Create `src/app/(dashboard)/dashboard/proyectos/nuevo/WizardStep3.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  ArrowLeft, Building2, Calendar, ChevronDown, ChevronRight,
  Layers, Plus, Save, Trash2, X,
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
  onSubmit: () => void;
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

  // Resolve assignments to per-task asignado_a and call onSubmit
  function handleCreate() {
    // Apply hierarchical assignments to tareas
    setTareas((prev) => prev.map((t) => {
      const faseAssign = assignments.find((a) => a.fase === t.fase);
      if (!faseAssign) return t;

      // For each torre, check if this task's espacio maps to a contratista
      // Since tasks are per-phase (not per-tower), we use the first torre's assignment
      // as the default. The API creates tasks per unit/tower, so assigning at wizard level
      // means the same contratista for all towers (unless desglosado).
      // For simplicity: iterate towers and pick the first matching assignment.
      for (const [, torreAssign] of Object.entries(faseAssign.distribucion)) {
        if (torreAssign.desglosado && torreAssign.por_actividad[t.espacio] !== undefined) {
          return { ...t, asignado_a: torreAssign.por_actividad[t.espacio] ?? undefined };
        }
        if (torreAssign.contratista_global) {
          return { ...t, asignado_a: torreAssign.contratista_global };
        }
      }
      return t;
    }));

    // Call the submit callback after state update settles
    setTimeout(onSubmit, 0);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/WizardStep3.tsx
git commit -m "feat: WizardStep3 with hierarchical phase/tower/activity assignment"
```

---

## Task 8: Rewrite wizard.tsx as thin orchestrator

**Files:**
- Modify: `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx`

Replace the entire file content with a slim orchestrator that holds state and delegates rendering to the three step components.

- [ ] **Step 1: Rewrite wizard.tsx**

Replace the entire contents of `src/app/(dashboard)/dashboard/proyectos/nuevo/wizard.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import type { Contratista, TipoUnidadInput, EdificioInput, TareaInput } from "./wizard-types";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";

export default function WizardClient({ contratistas }: { contratistas: Contratista[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 state
  const [nombre, setNombre] = useState("");
  const [subtipo, setSubtipo] = useState<"APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES">("APARTAMENTOS");
  const [diasHabiles, setDiasHabiles] = useState(5);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [tiposUnidad, setTiposUnidad] = useState<TipoUnidadInput[]>([
    { id: "t1", nombre: "Tipo estandar", espacios: ["Cocina", "Bano principal", "Habitacion principal", "Sala-comedor"] },
  ]);
  const [edificios, setEdificios] = useState<EdificioInput[]>([
    { nombre: "Torre 1", pisos: 5, distribucion: { "t1": 4 } },
  ]);
  const [tieneZonasComunes, setTieneZonasComunes] = useState(false);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);

  // Step 2 state
  const allEspacios = [...new Set(tiposUnidad.flatMap((t) => t.espacios))];
  const [fasesSeleccionadas, setFasesSeleccionadas] = useState<string[]>(["Madera", "Obra Blanca"]);
  const [tareas, setTareas] = useState<TareaInput[]>([]);

  // Computed
  const totalUnidades = subtipo === "ZONAS_COMUNES" ? 0 : edificios.reduce((acc, e) => {
    const perFloor = Object.values(e.distribucion).reduce((s, n) => s + n, 0);
    return acc + e.pisos * perFloor;
  }, 0);
  const totalTareasGlobal = subtipo === "ZONAS_COMUNES"
    ? tareas.length * zonasSeleccionadas.length
    : totalUnidades * tareas.length;

  // Validation
  const canProceed1 = nombre.trim().length >= 3 && (
    subtipo === "ZONAS_COMUNES"
      ? zonasSeleccionadas.length > 0
      : edificios.length > 0
        && edificios.every((e) => e.nombre && e.pisos > 0 && Object.values(e.distribucion).some((n) => n > 0))
        && tiposUnidad.every((t) => t.espacios.length > 0)
  );
  const canProceed2 = allEspacios.length > 0 && fasesSeleccionadas.length > 0 && tareas.length > 0;

  async function handleSubmit() {
    setLoading(true);
    setError("");

    if (totalTareasGlobal > 5000) {
      setError(`Demasiadas tareas (${totalTareasGlobal}). Reduce el tamano del proyecto o las tareas por unidad.`);
      setLoading(false);
      return;
    }

    const esZonasComunes = subtipo === "ZONAS_COMUNES";

    const payload = {
      nombre,
      subtipo,
      dias_habiles_semana: diasHabiles,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin_estimada: fechaFin || undefined,
      tipos_unidad: tiposUnidad.map((t) => ({ nombre: t.nombre, espacios: t.espacios })),
      edificios: esZonasComunes ? [] : edificios.map((e) => ({
        nombre: e.nombre,
        pisos: e.pisos,
        distribucion: Object.fromEntries(
          Object.entries(e.distribucion).map(([tipoId, count]) => {
            const tipo = tiposUnidad.find((t) => t.id === tipoId);
            return [tipo?.nombre ?? tipoId, count];
          })
        ),
      })),
      espacios: allEspacios,
      fases: fasesSeleccionadas,
      tareas: tareas.map(({ id: _id, ...rest }) => rest),
      zonas_comunes: tieneZonasComunes || esZonasComunes ? zonasSeleccionadas : [],
    };

    const res = await fetch("/api/proyectos/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/proyectos/${data.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error creando proyecto");
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Back link */}
      <Link
        href="/dashboard/proyectos"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Volver a proyectos
      </Link>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? "bg-blue-600 text-white" : step > s ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
            }`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm font-medium ${step >= s ? "text-slate-800" : "text-slate-400"}`}>
              {s === 1 ? "Estructura" : s === 2 ? "Tareas" : "Asignar y crear"}
            </span>
            {s < 3 && <div className="w-6 h-px bg-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === 1 && (
        <WizardStep1
          nombre={nombre} setNombre={setNombre}
          subtipo={subtipo} setSubtipo={setSubtipo}
          diasHabiles={diasHabiles} setDiasHabiles={setDiasHabiles}
          fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
          fechaFin={fechaFin} setFechaFin={setFechaFin}
          tiposUnidad={tiposUnidad} setTiposUnidad={setTiposUnidad}
          edificios={edificios} setEdificios={setEdificios}
          tieneZonasComunes={tieneZonasComunes} setTieneZonasComunes={setTieneZonasComunes}
          zonasSeleccionadas={zonasSeleccionadas} setZonasSeleccionadas={setZonasSeleccionadas}
          canProceed={canProceed1}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <WizardStep2
          allEspacios={allEspacios}
          fasesSeleccionadas={fasesSeleccionadas}
          setFasesSeleccionadas={setFasesSeleccionadas}
          tareas={tareas}
          setTareas={setTareas}
          canProceed={canProceed2}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <WizardStep3
          nombre={nombre}
          subtipo={subtipo}
          diasHabiles={diasHabiles}
          edificios={edificios}
          fasesSeleccionadas={fasesSeleccionadas}
          tareas={tareas}
          setTareas={setTareas}
          contratistas={contratistas}
          totalUnidades={totalUnidades}
          totalTareasGlobal={totalTareasGlobal}
          loading={loading}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npx tsc --noEmit --pretty 2>&1 | tail -20
```
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/proyectos/nuevo/wizard.tsx
git commit -m "refactor: slim wizard.tsx to orchestrator, delegate to WizardStep1/2/3"
```

---

## Task 9: Remove ExcelButtons from project detail page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`
- Delete: `src/app/(dashboard)/dashboard/proyectos/[id]/ExcelButtons.tsx`

- [ ] **Step 1: Remove ExcelButtons import and usage from page.tsx**

In `src/app/(dashboard)/dashboard/proyectos/[id]/page.tsx`, remove the import on line 8:

```typescript
// DELETE this line:
import ExcelButtons from "./ExcelButtons";
```

And remove the usage block (lines 111-116):

```tsx
// DELETE this entire block:
        {/* Excel import/export */}
        {["ADMINISTRADOR", "DIRECTIVO"].includes(usuario.rol_ref.nivel_acceso) && (
          <div className="mb-4">
            <ExcelButtons proyectoId={id} />
          </div>
        )}
```

- [ ] **Step 2: Delete ExcelButtons.tsx**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
rm src/app/\(dashboard\)/dashboard/proyectos/\[id\]/ExcelButtons.tsx
```

- [ ] **Step 3: Verify the build compiles**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npx tsc --noEmit --pretty 2>&1 | tail -10
```
Expected: No errors related to ExcelButtons.

- [ ] **Step 4: Commit**

```bash
git add -u src/app/\(dashboard\)/dashboard/proyectos/\[id\]/ExcelButtons.tsx src/app/\(dashboard\)/dashboard/proyectos/\[id\]/page.tsx
git commit -m "remove: ExcelButtons from project detail page (moved to wizard)"
```

---

## Task 10: Integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full build**

Run:
```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npx next build 2>&1 | tail -20
```
Expected: Build succeeds.

- [ ] **Step 2: Manual smoke test checklist**

Start the dev server and verify each change in the browser:

```bash
cd "/Users/victorjrp92/Library/Mobile Documents/com~apple~CloudDocs/Documents/Projects/Saas_construccion /obracontrol"
npm run dev
```

Navigate to `/dashboard/proyectos/nuevo` and check:

1. **Step 1 - Custom spaces:** Select a unit type, verify "Zona de lavado" shows (not "Zona de labores"). Type a custom space name like "Patio", press Enter. Verify it appears as a chip with an X button. Verify duplicates are blocked (case-insensitive).

2. **Step 1 - Numeric inputs:** Click on the "Pisos" field, select all, delete. Verify the field shows empty (not stuck on "0"). Type a new number. Tab out. Verify the value persists. Do the same for distribution inputs.

3. **Step 2 - Phase sections:** Verify each phase has its own collapsible section. Expand "Obra Blanca". Verify it has its own "Generar sugeridas", "Agregar manual", "Descargar plantilla", "Subir plantilla" buttons.

4. **Step 2 - Suggestions panel:** Click "Generar sugeridas" in Obra Blanca. Verify the panel shows tasks grouped by space with checkboxes. Toggle individual tasks, toggle "Seleccionar todo" per space and globally. Click "Agregar N seleccionadas". Verify tasks appear in the phase's task list. Click "Generar sugeridas" again -- already-added tasks should show "ya existe" and be disabled.

5. **Step 2 - Excel template:** Click "Descargar plantilla" in a phase. Open the downloaded .xlsx. Verify it has "Tareas" and "Instrucciones" sheets. Verify 3 example rows with "[EJEMPLO]" prefix. Verify the Espacio column has a dropdown. Fill in a few real tasks, save. Click "Subir plantilla" and upload. Verify tasks appear in the list. Verify example rows are skipped.

6. **Step 3 - Hierarchical assignment:** Verify summary cards are shown. Verify each phase has a section with "Agregar contratista" dropdown. Add a contratista. Verify per-tower dropdowns appear. Select a contratista for a tower. Click "Desglosar por actividad" in a tower. Verify per-space dropdowns appear. Click "Crear proyecto". Verify the project is created and tasks have the correct assignments.

7. **Project detail page:** Navigate to an existing project. Verify ExcelButtons are gone (no "Descargar plantilla Excel" or "Subir tareas" buttons in the project view). Verify EditProyecto and all other content still renders.

- [ ] **Step 3: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task |
|---|---|
| 2.1 Custom spaces in unit types | Task 3 (WizardStep1: `addCustomSpace`, `removeCustomSpace`, custom chip rendering, input with Enter/click) |
| 2.1 Rename "Zona de labores" -> "Zona de lavado" | Task 1 (task-templates.ts: ESPACIOS_SUGERIDOS, TASK_TEMPLATES keys + task names) |
| 2.2 Numeric inputs without stuck "0" | Task 3 (WizardStep1: `numericStrings` state, `getNumericDisplay`, `handleNumericChange`, `handleNumericBlur`, `type="text" inputMode="numeric"`) |
| 2.3 Step 2 divided by phases | Task 6 (WizardStep2: per-phase collapsible sections with independent buttons) |
| 2.4 Suggested tasks with checkboxes | Task 4 (SuggestedTasksPanel: grouped by space, select-all per space and global, dedup check, "Agregar N seleccionadas") |
| 2.5 Excel template in Step 2 | Task 5 (ExcelTemplateUtils: `generatePhaseTemplate` with 3 example rows and dropdown, `parsePhaseTemplate` with [EJEMPLO] skip), Task 6 (WizardStep2: download/upload buttons per phase) |
| 2.6 Step 3 hierarchical assignment | Task 7 (WizardStep3: per-phase contratistas, per-tower dropdown, desglosar por actividad, resolve to per-task `asignado_a`) |
| 2.7 Remove ExcelButtons | Task 9 (delete component, remove import and usage from page.tsx) |
| Decompose wizard.tsx | Task 2 (types), Task 3/4/5/6/7 (sub-components), Task 8 (slim orchestrator) |
| API routes kept | Task 9 notes: plantilla and importar-tareas routes are NOT deleted |
| No schema changes | Confirmed: no Prisma changes in any task |

All spec requirements covered.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later", "fill in details" found.
- No "similar to Task N" references.
- No "add appropriate error handling" without code.
- All steps have code blocks where code changes are made.

### 3. Type consistency

- `TareaInput` used consistently across wizard-types.ts, WizardStep2, WizardStep3, SuggestedTasksPanel, ExcelTemplateUtils.
- `FaseAssignment` and `TorreAssignment` defined in wizard-types.ts, used in WizardStep3.
- `Contratista`, `TipoUnidadInput`, `EdificioInput` defined in wizard-types.ts, used in wizard.tsx and WizardStep1/3.
- `FASES_DISPONIBLES` exported from wizard-types.ts, imported in WizardStep2.
- `TaskTemplate` from `@/lib/task-templates` used in SuggestedTasksPanel.
- `getTareasSugeridas` from `@/lib/task-templates` used in SuggestedTasksPanel.
- `generatePhaseTemplate`, `parsePhaseTemplate` from ExcelTemplateUtils used in WizardStep2.
- `canProceed` boolean passed consistently to Step1 and Step2.
- `onNext`, `onBack`, `onSubmit` callback naming is consistent.

All names and signatures are consistent across tasks.
