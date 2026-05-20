"use client";

import { useState, useRef } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronRight,
  Download, Pencil, Plus, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import type { TareaInput, TipoUnidadInput } from "./wizard-types";
import type { TaskTemplate } from "@/lib/task-templates";
import { FASES_DISPONIBLES } from "./wizard-types";
import SuggestedTasksPanel from "./SuggestedTasksPanel";
import { generateTemplate, parseTemplate } from "./ExcelTemplateUtils";

function groupBySubfaseEspacio(tareas: TareaInput[]) {
  const result = new Map<string, Map<string, TareaInput[]>>();
  for (const t of tareas) {
    const sf = t.subfase ?? "__sin_subfase__";
    if (!result.has(sf)) result.set(sf, new Map());
    const espacioMap = result.get(sf)!;
    if (!espacioMap.has(t.espacio)) espacioMap.set(t.espacio, []);
    espacioMap.get(t.espacio)!.push(t);
  }
  return result;
}

interface WizardStep2Props {
  allEspacios: string[];
  fasesSeleccionadas: string[];
  setFasesSeleccionadas: React.Dispatch<React.SetStateAction<string[]>>;
  tareas: TareaInput[];
  setTareas: React.Dispatch<React.SetStateAction<TareaInput[]>>;
  faseDias: Record<string, number | undefined>;
  onFaseDiasChange: (fase: string, dias: number | undefined) => void;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  tareasAprendidas?: Record<string, Record<string, TaskTemplate[]>>;
  tiposUnidad?: TipoUnidadInput[];
}

export default function WizardStep2({
  allEspacios,
  fasesSeleccionadas,
  setFasesSeleccionadas,
  tareas,
  setTareas,
  faseDias,
  onFaseDiasChange,
  canProceed,
  onNext,
  onBack,
  tareasAprendidas,
  tiposUnidad,
}: WizardStep2Props) {
  // Collapsed state per fase
  const [collapsedFases, setCollapsedFases] = useState<Record<string, boolean>>({});
  // Which fase has the suggestions panel open
  const [suggestionsOpenFase, setSuggestionsOpenFase] = useState<string | null>(null);
  // Which fase has the manual add form open
  const [addFormOpenFase, setAddFormOpenFase] = useState<string | null>(null);
  // Manual add form state
  const [newTaskEspacio, setNewTaskEspacio] = useState("");
  const [newTaskSubfase, setNewTaskSubfase] = useState("");
  const [newTaskNombre, setNewTaskNombre] = useState("");
  const [newTaskDias, setNewTaskDias] = useState(3);
  const [newTaskPrecio, setNewTaskPrecio] = useState<number | undefined>(undefined);
  // Excel upload state per fase
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editEspacio, setEditEspacio] = useState("");
  const [editSubfase, setEditSubfase] = useState("");
  const [editDias, setEditDias] = useState(3);
  const [editPrecio, setEditPrecio] = useState<number | undefined>(undefined);
  const [excelErrors, setExcelErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTipoPerFase, setSelectedTipoPerFase] = useState<Record<string, string>>({});
  const [newTaskEstructura, setNewTaskEstructura] = useState(true);
  const [newTaskNave, setNewTaskNave] = useState(true);
  const [newTaskChapa, setNewTaskChapa] = useState(false);
  const [newTaskCartera, setNewTaskCartera] = useState(false);

  function toggleFase(fase: string) {
    setFasesSeleccionadas((prev) =>
      prev.includes(fase) ? prev.filter((f) => f !== fase) : [...prev, fase]
    );
  }

  function toggleCollapse(fase: string) {
    setCollapsedFases((prev) => ({ ...prev, [fase]: !prev[fase] }));
  }

  function updatePrecio(id: string, precio: number | undefined) {
    setTareas((prev) => prev.map((t) => t.id === id ? { ...t, precio } : t));
  }

  function updateLustroDias(id: string, dias: number) {
    setTareas((prev) => prev.map((t) => t.id === id ? { ...t, lustro_dias: dias } : t));
  }

  function updateLustroPrecio(id: string, precio: number | undefined) {
    setTareas((prev) => prev.map((t) => t.id === id ? { ...t, lustro_precio: precio } : t));
  }

  function toggleLustroExcluido(id: string) {
    setTareas((prev) => prev.map((t) => t.id === id ? { ...t, lustro_excluido: !t.lustro_excluido } : t));
  }

  function getSelectedTipoId(fase: string): string | undefined {
    if (fase !== "Madera" || !tiposUnidad?.length) return undefined;
    return selectedTipoPerFase[fase] ?? tiposUnidad[0].id;
  }

  function getEspaciosForFase(fase: string): string[] {
    if (fase !== "Madera" || !tiposUnidad?.length) return allEspacios;
    const tipoId = getSelectedTipoId(fase);
    const tipo = tiposUnidad.find((t) => t.id === tipoId);
    return tipo?.espacios ?? allEspacios;
  }

  function updateComponent(id: string, field: string, value: boolean) {
    setTareas((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  }

  function removeTarea(id: string) {
    setTareas((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function startEdit(t: TareaInput) {
    setEditingId(t.id);
    setEditNombre(t.nombre);
    setEditEspacio(t.espacio);
    setEditSubfase(t.subfase ?? "");
    setEditDias(t.tiempo_acordado_dias);
    setEditPrecio(t.precio);
  }

  function saveEdit(id: string) {
    if (!editNombre.trim() || !editEspacio) return;
    setTareas((prev) => prev.map((t) =>
      t.id === id ? { ...t, nombre: editNombre.trim(), espacio: editEspacio, subfase: editSubfase || undefined, tiempo_acordado_dias: editDias, precio: editPrecio } : t
    ));
    setEditingId(null);
  }

  function addSuggestedTareas(fase: string, nuevas: Omit<TareaInput, "id">[]) {
    let counter = Date.now();
    const tipoId = getSelectedTipoId(fase);
    const withIds: TareaInput[] = nuevas.map((t) => ({
      ...t,
      id: `sug-${counter++}`,
      ...(fase === "Madera" && tipoId ? {
        tipo_unidad_id: tipoId,
        lustro_dias: t.tiempo_acordado_dias,
        lustro_excluido: false,
      } : {}),
    }));
    setTareas((prev) => [...prev, ...withIds]);
  }

  function openAddForm(fase: string) {
    setAddFormOpenFase(fase);
    const espacios = getEspaciosForFase(fase);
    if (espacios.length > 0) setNewTaskEspacio(espacios[0]);
    setNewTaskSubfase("");
    setNewTaskNombre("");
    setNewTaskDias(3);
    setNewTaskPrecio(undefined);
    if (fase === "Madera") {
      setNewTaskEstructura(true);
      setNewTaskNave(true);
      setNewTaskChapa(false);
      setNewTaskCartera(false);
    }
  }

  function deleteAllTareasInFase(fase: string) {
    if (!confirm(`¿Eliminar todas las tareas de ${fase}?`)) return;
    setTareas((prev) => prev.filter((t) => t.fase !== fase));
  }

  function deleteAllTareasInFaseTipo(fase: string, tipoId: string, tipoNombre: string) {
    if (!confirm(`¿Eliminar todas las tareas de ${tipoNombre} en ${fase}?`)) return;
    setTareas((prev) => prev.filter((t) => !(t.fase === fase && t.tipo_unidad_id === tipoId)));
  }

  function addCustomTask(fase: string) {
    if (!newTaskEspacio || !newTaskNombre.trim()) return;
    const id = `custom-${Date.now()}`;
    const isMadera = fase === "Madera";
    setTareas((prev) => [...prev, {
      id,
      fase,
      subfase: isMadera ? undefined : (newTaskSubfase || undefined),
      espacio: newTaskEspacio,
      nombre: newTaskNombre.trim(),
      tiempo_acordado_dias: newTaskDias,
      precio: newTaskPrecio,
      ...(isMadera ? {
        tipo_unidad_id: getSelectedTipoId(fase),
        tiene_estructura: newTaskEstructura,
        tiene_nave: newTaskNave,
        tiene_chapa: newTaskChapa,
        tiene_cartera: newTaskCartera,
        lustro_dias: newTaskDias,
        lustro_excluido: false,
      } : {}),
    }]);
    setNewTaskNombre("");
    setNewTaskSubfase("");
    setNewTaskDias(3);
    setNewTaskPrecio(undefined);
    if (isMadera) {
      setNewTaskEstructura(true);
      setNewTaskNave(true);
      setNewTaskChapa(false);
      setNewTaskCartera(false);
    }
  }

  async function handleExcelDownload() {
    const tipoNames = tiposUnidad?.map((t) => t.nombre);
    await generateTemplate(fasesSeleccionadas, allEspacios, tipoNames);
  }

  async function handleExcelUpload(file: File) {
    setUploading(true);
    setExcelErrors([]);

    const tipoMap = tiposUnidad?.map((t) => ({ id: t.id, nombre: t.nombre }));
    const result = await parseTemplate(file, fasesSeleccionadas, allEspacios, tipoMap);

    if (result.errores.length > 0) {
      setExcelErrors(result.errores);
    }

    if (result.tareas.length > 0) {
      let counter = Date.now();
      const withIds: TareaInput[] = result.tareas.map((t) => ({
        ...t,
        id: `excel-${counter++}`,
        ...(t.fase === "Madera" ? { lustro_dias: t.tiempo_acordado_dias, lustro_excluido: false } : {}),
      }));
      setTareas((prev) => {
        const map = new Map<string, TareaInput>();
        for (const t of prev) map.set(`${t.fase}|${t.espacio}|${t.nombre}`, t);
        for (const t of withIds) map.set(`${t.fase}|${t.espacio}|${t.nombre}`, t);
        return Array.from(map.values());
      });
    }

    setUploading(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Fases y tareas</h2>
      <p className="text-xs text-slate-500 mb-5">
        Espacios definidos por tipo: {allEspacios.join(", ") || "—"}
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

      {/* Excel template toolbar (single for all phases) */}
      {fasesSeleccionadas.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExcelDownload()}
              className="inline-flex items-center gap-1.5 text-slate-600 bg-white border border-slate-200 hover:border-slate-300 font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar plantilla Excel
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Importando..." : "Subir plantilla Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleExcelUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Excel upload errors */}
          {excelErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3 text-xs text-red-700">
              <p className="font-semibold mb-1">Errores al importar:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {excelErrors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {excelErrors.length > 5 && (
                  <li>...y {excelErrors.length - 5} errores mas</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Phase sections */}
      {fasesSeleccionadas.map((fase) => {
        const faseTareas = tareas.filter((t) => t.fase === fase);
        const isCollapsed = collapsedFases[fase] ?? false;
        const isMadera = fase === "Madera";
        const selectedTipoId = isMadera ? getSelectedTipoId(fase) : undefined;
        const espaciosForFase = getEspaciosForFase(fase);
        const displayTareas = isMadera && selectedTipoId
          ? faseTareas.filter((t) => t.tipo_unidad_id === selectedTipoId)
          : faseTareas;

        return (
          <div key={fase} className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            {/* Phase header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <button
                onClick={() => toggleCollapse(fase)}
                className="flex items-center gap-2 flex-1"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-slate-500" />
                  : <ChevronDown className="w-4 h-4 text-slate-500" />
                }
                <span className="text-sm font-bold text-slate-800">{fase}</span>
                <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {faseTareas.length} tarea{faseTareas.length !== 1 ? "s" : ""}
                </span>
              </button>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  min="1"
                  placeholder="Dias"
                  value={faseDias[fase] ?? ""}
                  onChange={(e) => onFaseDiasChange(fase, e.target.value ? Number(e.target.value) : undefined)}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                />
                <span className="text-[10px] text-slate-400">dias est.</span>
              </div>
            </div>

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
                  {faseTareas.length > 0 && (
                    <button
                      onClick={() => deleteAllTareasInFase(fase)}
                      className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar todas
                    </button>
                  )}
                </div>

                {/* Tipo tabs for Madera */}
                {isMadera && tiposUnidad && tiposUnidad.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tiposUnidad.map((tipo) => {
                      const isSelected = selectedTipoId === tipo.id;
                      const count = faseTareas.filter((t) => t.tipo_unidad_id === tipo.id).length;
                      return (
                        <button
                          key={tipo.id}
                          onClick={() => setSelectedTipoPerFase((prev) => ({ ...prev, [fase]: tipo.id }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            isSelected
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-violet-300"
                          }`}
                        >
                          {tipo.nombre}
                          {count > 0 && (
                            <span className={`ml-1.5 text-[10px] ${isSelected ? "text-violet-200" : "text-slate-400"}`}>
                              ({count})
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {selectedTipoId && faseTareas.filter((t) => t.tipo_unidad_id === selectedTipoId).length > 0 && (
                      <button
                        onClick={() => {
                          const tipoNombre = tiposUnidad?.find((t) => t.id === selectedTipoId)?.nombre ?? "";
                          deleteAllTareasInFaseTipo(fase, selectedTipoId, tipoNombre);
                        }}
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-600 text-[10px] px-2 py-1.5 rounded-full cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar tipo
                      </button>
                    )}
                  </div>
                )}

                {/* Suggestions panel */}
                {suggestionsOpenFase === fase && (
                  <SuggestedTasksPanel
                    fase={fase}
                    espacios={espaciosForFase}
                    existingTareas={tareas}
                    onAdd={(nuevas) => addSuggestedTareas(fase, nuevas)}
                    onClose={() => setSuggestionsOpenFase(null)}
                    tareasAprendidas={tareasAprendidas}
                    tipoUnidadId={selectedTipoId}
                  />
                )}

                {/* Manual add form */}
                {addFormOpenFase === fase && (
                  <div className={`${isMadera ? "bg-violet-50 border-violet-200" : "bg-blue-50 border-blue-200"} border rounded-xl p-4 mb-4`}>
                    <h4 className="text-sm font-bold text-slate-800 mb-3">
                      Nueva tarea - {fase}
                      {isMadera && selectedTipoId && tiposUnidad && (
                        <span className="ml-2 text-xs font-medium text-violet-600">
                          ({tiposUnidad.find((t) => t.id === selectedTipoId)?.nombre})
                        </span>
                      )}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Espacio</label>
                        <select
                          value={newTaskEspacio}
                          onChange={(e) => setNewTaskEspacio(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                        >
                          {espaciosForFase.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                      </div>
                      {!isMadera && (
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Subfase</label>
                          <input
                            value={newTaskSubfase}
                            onChange={(e) => setNewTaskSubfase(e.target.value)}
                            placeholder="Ej: Instalación"
                            className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                          />
                        </div>
                      )}
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
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Precio (COP, opcional)</label>
                        <input
                          type="number"
                          step="1000"
                          min="0"
                          value={newTaskPrecio ?? ""}
                          onChange={(e) => setNewTaskPrecio(e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="Ej: 250000"
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                        />
                      </div>
                    </div>
                    {/* Component checkboxes for Madera */}
                    {isMadera && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={newTaskEstructura} onChange={(e) => setNewTaskEstructura(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                          Estructura
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={newTaskNave} onChange={(e) => setNewTaskNave(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                          Nave
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={newTaskChapa} onChange={(e) => setNewTaskChapa(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                          Chapa
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input type="checkbox" checked={newTaskCartera} onChange={(e) => setNewTaskCartera(e.target.checked)} className="w-3.5 h-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                          Cartera
                        </label>
                      </div>
                    )}
                    <button
                      onClick={() => addCustomTask(fase)}
                      disabled={!newTaskEspacio || !newTaskNombre.trim()}
                      className={`inline-flex items-center gap-1.5 ${isMadera ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"} disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>
                )}

                {/* Task list — dual panel for Madera, single for others */}
                {displayTareas.length > 0 && (() => {
                  const lustroTareas = isMadera ? displayTareas.filter((t) => !t.lustro_excluido) : [];

                  const renderInstalacionRow = (t: TareaInput) => (
                    editingId === t.id ? (
                      <div key={t.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50">
                        <select value={editEspacio} onChange={(e) => setEditEspacio(e.target.value)} className="text-[10px] w-24 px-1 py-1 rounded border border-blue-300 bg-white flex-shrink-0">
                          {espaciosForFase.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                        {!isMadera && <input value={editSubfase} onChange={(e) => setEditSubfase(e.target.value)} placeholder="Subfase" className="text-[10px] w-20 px-1 py-1 rounded border border-blue-300 bg-white flex-shrink-0" />}
                        <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(t.id); } if (e.key === "Escape") setEditingId(null); }} className="text-xs flex-1 px-2 py-1 rounded border border-blue-300 bg-white" autoFocus />
                        <input type="number" min="1" value={editDias} onChange={(e) => setEditDias(Number(e.target.value) || 1)} className="w-12 text-xs text-center px-1 py-1 rounded border border-blue-300 bg-white flex-shrink-0" />
                        <input type="number" min="0" value={editPrecio ?? ""} onChange={(e) => setEditPrecio(e.target.value ? Number(e.target.value) : undefined)} placeholder="COP" className="w-20 text-xs text-right px-1 py-1 rounded border border-blue-300 bg-white flex-shrink-0" />
                        <button onClick={() => saveEdit(t.id)} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div key={t.id} className="flex items-center gap-1.5 px-3 py-2 hover:bg-slate-50/50">
                        <span className="text-xs font-medium text-slate-800 flex-1 truncate">{t.nombre}</span>
                        {isMadera && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {(["tiene_estructura", "tiene_nave", "tiene_chapa", "tiene_cartera"] as const).map((field) => {
                              const label = { tiene_estructura: "Est", tiene_nave: "Nav", tiene_chapa: "Cha", tiene_cartera: "Car" }[field];
                              return (
                                <label key={field} className="flex items-center gap-0.5 text-[9px] text-slate-500">
                                  <input type="checkbox" checked={t[field] ?? false} onChange={(e) => updateComponent(t.id, field, e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                                  {label}
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{t.tiempo_acordado_dias}d</span>
                        <input type="number" min="0" value={t.precio ?? ""} onChange={(e) => updatePrecio(t.id, e.target.value ? Number(e.target.value) : undefined)} placeholder="COP" className="w-20 text-xs text-right px-1.5 py-1 rounded border border-slate-200 bg-white flex-shrink-0 focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                        <button onClick={() => startEdit(t)} className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"><Pencil className="w-3 h-3" /></button>
                        <button onClick={() => removeTarea(t.id)} className="p-0.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    )
                  );

                  const renderGroupedTasks = (tareasToRender: TareaInput[], renderRow: (t: TareaInput) => React.ReactNode) => {
                    const grps = groupBySubfaseEspacio(tareasToRender);
                    return Array.from(grps.entries()).map(([subfase, espacioMap]) => (
                      <div key={subfase}>
                        {Array.from(espacioMap.entries()).map(([espacio, tareasGrupo]) => (
                          <div key={`${subfase}::${espacio}`}>
                            <div className="px-3 py-1 bg-slate-50/80 border-b border-slate-100">
                              <span className="text-[10px] font-semibold text-slate-500">{espacio}</span>
                            </div>
                            <div className="divide-y divide-slate-50">
                              {tareasGrupo.map(renderRow)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  };

                  if (isMadera) {
                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {/* Left panel — Instalación */}
                        <div className="border border-violet-200 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-violet-50 text-xs font-bold text-violet-700 border-b border-violet-200">
                            Instalación ({displayTareas.length})
                            {selectedTipoId && tiposUnidad && (
                              <span className="ml-1 font-medium text-violet-500">— {tiposUnidad.find((t) => t.id === selectedTipoId)?.nombre}</span>
                            )}
                          </div>
                          <div className="max-h-[28rem] overflow-y-auto">
                            {renderGroupedTasks(displayTareas, renderInstalacionRow)}
                          </div>
                        </div>

                        {/* Right panel — Detallado y Lustro */}
                        <div className="border border-amber-200 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-amber-50 text-xs font-bold text-amber-700 border-b border-amber-200">
                            Detallado y Lustro ({lustroTareas.length}/{displayTareas.length})
                          </div>
                          <div className="max-h-[28rem] overflow-y-auto">
                            {renderGroupedTasks(displayTareas, (t) => {
                              const excluded = t.lustro_excluido ?? false;
                              return (
                                <div key={`lustro-${t.id}`} className={`flex items-center gap-1.5 px-3 py-2 hover:bg-amber-50/30 ${excluded ? "opacity-40" : ""}`}>
                                  <span className={`text-xs flex-1 truncate ${excluded ? "line-through text-slate-400" : "font-medium text-slate-800"}`}>{t.nombre}</span>
                                  <input
                                    type="number" min="1"
                                    value={t.lustro_dias ?? t.tiempo_acordado_dias}
                                    onChange={(e) => updateLustroDias(t.id, Number(e.target.value) || 1)}
                                    disabled={excluded}
                                    className="w-12 text-xs text-center px-1 py-1 rounded border border-slate-200 bg-white flex-shrink-0 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                                  />
                                  <span className="text-[10px] text-slate-400 flex-shrink-0">d</span>
                                  <input
                                    type="number" min="0"
                                    value={t.lustro_precio ?? ""}
                                    onChange={(e) => updateLustroPrecio(t.id, e.target.value ? Number(e.target.value) : undefined)}
                                    disabled={excluded}
                                    placeholder="COP"
                                    className="w-20 text-xs text-right px-1.5 py-1 rounded border border-slate-200 bg-white flex-shrink-0 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                                  />
                                  <button
                                    onClick={() => toggleLustroExcluido(t.id)}
                                    title={excluded ? "Incluir en lustro" : "Excluir de lustro"}
                                    className={`p-0.5 rounded cursor-pointer ${excluded ? "text-green-600 hover:bg-green-50" : "text-red-500 hover:bg-red-50"}`}
                                  >
                                    {excluded ? <Plus className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-100">
                        {displayTareas.length} tarea{displayTareas.length !== 1 ? "s" : ""} en {fase}
                      </div>
                      <div className="max-h-[28rem] overflow-y-auto">
                        {renderGroupedTasks(displayTareas, renderInstalacionRow)}
                      </div>
                    </div>
                  );
                })()}

                {displayTareas.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">
                    {isMadera && selectedTipoId && tiposUnidad
                      ? `No hay tareas para ${tiposUnidad.find((t) => t.id === selectedTipoId)?.nombre ?? "este tipo"}. Genera sugeridas o agrega manualmente.`
                      : "No hay tareas en esta fase. Genera sugeridas, agrega manualmente o sube una plantilla Excel."}
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
