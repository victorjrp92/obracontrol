"use client";

import { useState, useMemo } from "react";
import { Check, X } from "lucide-react";
import { getTareasSugeridas } from "@/lib/task-templates";
import type { TaskTemplate } from "@/lib/task-templates";
import type { TareaInput, TipoUnidadInput } from "./wizard-types";
import { areaTipica } from "@/lib/estimar-presupuesto";

interface SuggestedTask extends TaskTemplate {
  espacio: string;
}

/**
 * Mezcla las plantillas estáticas con las aprendidas de la constructora para
 * una (fase, espacio), sin duplicar por nombre. Es LA definición de «tareas
 * sugeridas»: la usa este panel y el botón «Generar para todos los tipos» de
 * WizardStep2 — si divergieran, ese botón agregaría tareas que el panel no
 * enseña, o al revés.
 */
export function plantillasSugeridas(
  fase: string,
  espacio: string,
  tareasAprendidas?: Record<string, Record<string, TaskTemplate[]>>,
): TaskTemplate[] {
  const estaticas = getTareasSugeridas(fase, espacio);
  const aprendidas = tareasAprendidas?.[fase]?.[espacio] ?? [];
  const vistas = new Set(estaticas.map((t) => t.nombre));
  return [...estaticas, ...aprendidas.filter((t) => !vistas.has(t.nombre))];
}

/**
 * Escala los días de una plantilla al metraje REAL del espacio en un tipo de
 * unidad: un Tipo A de 100 m² no puede llevar los mismos días que un B de
 * 62 m². Regla, en orden:
 *  1. metraje del espacio en el tipo (`metrajes_espacios`);
 *  2. si no hay, `metraje_total` repartido a partes iguales entre sus espacios;
 *  3. si tampoco, no se escala (los días de la plantilla ya son el estimado).
 * El factor se limita a [0.5, 3]: un metraje absurdo (un dedazo en el paso 1)
 * no puede convertir 2 días en 40. Y nunca baja de 1 día — no existen tareas
 * de cero días en el cronograma.
 */
export function escalarDiasPorMetraje(
  diasPlantilla: number,
  espacio: string,
  tipo?: TipoUnidadInput,
): number {
  if (!tipo) return diasPlantilla;
  let metraje = tipo.metrajes_espacios?.[espacio];
  if ((metraje == null || metraje <= 0) && tipo.metraje_total && tipo.metraje_total > 0 && tipo.espacios.length > 0) {
    metraje = tipo.metraje_total / tipo.espacios.length;
  }
  if (metraje == null || metraje <= 0) return diasPlantilla;
  const factor = Math.min(3, Math.max(0.5, metraje / areaTipica(espacio)));
  return Math.max(1, Math.round(diasPlantilla * factor));
}

interface SuggestedTasksPanelProps {
  fase: string;
  espacios: string[];
  existingTareas: TareaInput[];
  onAdd: (tareas: Omit<TareaInput, "id">[]) => void;
  onClose: () => void;
  tareasAprendidas?: Record<string, Record<string, TaskTemplate[]>>;
  tipoUnidadId?: string;
  /**
   * El OBJETO del tipo activo (no solo su id): hace falta para escalar los
   * días de las plantillas con sus metrajes. Opcional porque un proyecto de
   * zonas comunes no trabaja por tipos.
   */
  tipoUnidad?: TipoUnidadInput;
  // Obligatoria a proposito: sin defecto no hay forma de olvidarse de pasarla
  // y dejar el precio sugerido a la vista de una constructora.
  muestraEconomia: boolean;
}

export default function SuggestedTasksPanel({
  fase,
  espacios,
  existingTareas,
  onAdd,
  onClose,
  tareasAprendidas,
  tipoUnidadId,
  tipoUnidad,
  muestraEconomia,
}: SuggestedTasksPanelProps) {
  // Build grouped suggestions merging static templates + learned tasks
  const grouped = useMemo(() => {
    const result: { espacio: string; tareas: SuggestedTask[] }[] = [];
    for (const espacio of espacios) {
      const merged = plantillasSugeridas(fase, espacio, tareasAprendidas);
      if (merged.length > 0) {
        result.push({
          espacio,
          // Los días se enseñan y se agregan YA escalados al metraje del tipo
          // activo: el usuario decide sobre el número que de verdad se va a
          // guardar, no sobre el genérico de la plantilla. Siguen siendo
          // editables una vez agregados, como siempre.
          tareas: merged.map((t) => ({
            ...t,
            espacio,
            tiempo_acordado_dias: escalarDiasPorMetraje(t.tiempo_acordado_dias, espacio, tipoUnidad),
          })),
        });
      }
    }
    return result;
  }, [fase, espacios, tareasAprendidas, tipoUnidad]);

  const allSuggestions = useMemo(() => grouped.flatMap((g) => g.tareas), [grouped]);

  // Una sugerida «ya existe» si está en el MISMO tipo o si está SIN tipo: la
  // tarea genérica ya se replica en todas las unidades (proyectos viejos
  // rehidratan así), y agregarle la copia por tipo la duplicaría en el
  // servidor para las unidades de ese tipo.
  const yaExiste = (s: SuggestedTask): boolean =>
    existingTareas.some(
      (t) => t.fase === fase && t.espacio === s.espacio && t.nombre === s.nombre
        && (!tipoUnidadId || t.tipo_unidad_id === tipoUnidadId || !t.tipo_unidad_id)
    );

  // Track selected by a composite key "espacio::nombre"
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select all that are not already in existingTareas
    const keys = new Set<string>();
    for (const s of allSuggestions) {
      if (!yaExiste(s)) {
        keys.add(`${s.espacio}::${s.nombre}`);
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
      if (yaExiste(s)) continue;
      tareasToAdd.push({
        fase,
        subfase: s.subfase,
        espacio: s.espacio,
        nombre: s.nombre,
        tiempo_acordado_dias: s.tiempo_acordado_dias,
        codigo_referencia: s.codigo_referencia,
        marca_linea: s.marca_linea,
        componentes: s.componentes,
        precio: s.precio,
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
                  const isDuplicate = yaExiste(t);
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
                      {t.subfase && (
                        <span className="text-[10px] font-medium text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded flex-shrink-0">{t.subfase}</span>
                      )}
                      <span className="text-xs text-slate-700 flex-1">{t.nombre}</span>
                      {/* Precio sugerido: se deja de ENSEÑAR en B2B, se sigue
                          GUARDANDO (`precio: s.precio` en handleConfirm). Ese
                          dato es el flywheel de la empresa; apagar el render no
                          puede apagar la captura. En B2C se ve igual que antes. */}
                      {muestraEconomia && t.precio != null && t.precio > 0 && (
                        <span className="text-[10px] text-emerald-600 flex-shrink-0">
                          {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(t.precio)}
                        </span>
                      )}
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
