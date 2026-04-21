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
