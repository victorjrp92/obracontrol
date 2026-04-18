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
