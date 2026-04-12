"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Building2, Calendar, Check, ChevronLeft,
  Layers, Plus, Trash2, Sparkles, Save, Trees,
} from "lucide-react";
import { ESPACIOS_SUGERIDOS, ZONAS_COMUNES_SUGERIDAS, getTareasSugeridas, TASK_TEMPLATES } from "@/lib/task-templates";

interface Contratista {
  id: string;
  nombre: string;
  rol_ref: { nombre: string };
}

interface EdificioInput {
  nombre: string;
  pisos: number;
  unidadesPorPiso: number;
}

interface TareaInput {
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

const FASES_DISPONIBLES = ["Madera", "Obra Blanca"];

export default function WizardClient({ contratistas }: { contratistas: Contratista[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [subtipo, setSubtipo] = useState<"APARTAMENTOS" | "CASAS">("APARTAMENTOS");
  const [diasHabiles, setDiasHabiles] = useState(5);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [edificios, setEdificios] = useState<EdificioInput[]>([
    { nombre: "Torre 1", pisos: 5, unidadesPorPiso: 4 },
  ]);
  const [tieneZonasComunes, setTieneZonasComunes] = useState(false);
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<string[]>([]);
  const [zonaPersonalizada, setZonaPersonalizada] = useState("");

  // Paso 2
  const [espaciosSeleccionados, setEspaciosSeleccionados] = useState<string[]>([
    "Cocina", "Baño principal", "Habitación principal", "Sala-comedor",
  ]);
  const [fasesSeleccionadas, setFasesSeleccionadas] = useState<string[]>(["Madera", "Obra Blanca"]);
  const [tareas, setTareas] = useState<TareaInput[]>([]);

  function generarTareasSugeridas() {
    const nuevas: TareaInput[] = [];
    let counter = 0;
    for (const fase of fasesSeleccionadas) {
      for (const espacio of espaciosSeleccionados) {
        const sugeridas = getTareasSugeridas(fase, espacio);
        for (const t of sugeridas) {
          nuevas.push({
            id: `t${counter++}`,
            fase,
            espacio,
            nombre: t.nombre,
            tiempo_acordado_dias: t.tiempo_acordado_dias,
            codigo_referencia: t.codigo_referencia,
            marca_linea: t.marca_linea,
            componentes: t.componentes,
          });
        }
      }
    }
    setTareas(nuevas);
  }

  function addEdificio() {
    setEdificios([...edificios, { nombre: `Torre ${edificios.length + 1}`, pisos: 5, unidadesPorPiso: 4 }]);
  }

  function removeEdificio(idx: number) {
    setEdificios(edificios.filter((_, i) => i !== idx));
  }

  function updateEdificio(idx: number, field: keyof EdificioInput, value: string | number) {
    const next = [...edificios];
    next[idx] = { ...next[idx], [field]: value };
    setEdificios(next);
  }

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

  function toggleEspacio(espacio: string) {
    setEspaciosSeleccionados((prev) =>
      prev.includes(espacio) ? prev.filter((e) => e !== espacio) : [...prev, espacio]
    );
  }

  function toggleFase(fase: string) {
    setFasesSeleccionadas((prev) =>
      prev.includes(fase) ? prev.filter((f) => f !== fase) : [...prev, fase]
    );
  }

  // Custom task form
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskFase, setNewTaskFase] = useState("");
  const [newTaskEspacio, setNewTaskEspacio] = useState("");
  const [newTaskNombre, setNewTaskNombre] = useState("");
  const [newTaskDias, setNewTaskDias] = useState(3);

  function addCustomTask() {
    if (!newTaskFase || !newTaskEspacio || !newTaskNombre.trim()) return;
    const id = `custom-${Date.now()}`;
    setTareas([...tareas, {
      id,
      fase: newTaskFase,
      espacio: newTaskEspacio,
      nombre: newTaskNombre.trim(),
      tiempo_acordado_dias: newTaskDias,
    }]);
    setNewTaskNombre("");
    setNewTaskDias(3);
  }

  function removeTarea(id: string) {
    setTareas(tareas.filter((t) => t.id !== id));
  }

  function updateTareaAsignacion(id: string, asignado_a: string) {
    setTareas(tareas.map((t) => (t.id === id ? { ...t, asignado_a } : t)));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const totalUnidades = edificios.reduce((acc, e) => acc + e.pisos * e.unidadesPorPiso, 0);
    const totalTareas = totalUnidades * tareas.length;

    if (totalTareas > 5000) {
      setError(`Demasiadas tareas (${totalTareas}). Reduce el tamaño del proyecto o las tareas por unidad.`);
      setLoading(false);
      return;
    }

    const payload = {
      nombre,
      subtipo,
      dias_habiles_semana: diasHabiles,
      fecha_inicio: fechaInicio || undefined,
      fecha_fin_estimada: fechaFin || undefined,
      edificios,
      espacios: espaciosSeleccionados,
      fases: fasesSeleccionadas,
      tareas: tareas.map(({ ...rest }) => rest),
      zonas_comunes: tieneZonasComunes ? zonasSeleccionadas : [],
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

  // Cálculos derivados
  const totalUnidades = edificios.reduce((acc, e) => acc + e.pisos * e.unidadesPorPiso, 0);
  const totalTareasPorUnidad = tareas.length;
  const totalTareasGlobal = totalUnidades * totalTareasPorUnidad;

  const canProceed1 = nombre.trim().length >= 3 && edificios.length > 0 && edificios.every((e) => e.nombre && e.pisos > 0 && e.unidadesPorPiso > 0);
  const canProceed2 = espaciosSeleccionados.length > 0 && fasesSeleccionadas.length > 0 && tareas.length > 0;

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

      {/* PASO 1: Estructura */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-3xl">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Información del proyecto</h2>

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
                onChange={(e) => setSubtipo(e.target.value as "APARTAMENTOS" | "CASAS")}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              >
                <option value="APARTAMENTOS">Apartamentos</option>
                <option value="CASAS">Casas</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Días hábiles/semana</label>
              <select
                value={diasHabiles}
                onChange={(e) => setDiasHabiles(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              >
                <option value={5}>5 días (lun-vie)</option>
                <option value={6}>6 días (lun-sáb)</option>
                <option value={7}>7 días</option>
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

          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Torres / Edificios</h3>
              <button onClick={addEdificio} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Agregar torre
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {edificios.map((e, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-end p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">Nombre</label>
                    <input
                      value={e.nombre}
                      onChange={(ev) => updateEdificio(idx, "nombre", ev.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-slate-500 mb-1 block">Pisos</label>
                    <input
                      type="number" min="1"
                      value={e.pisos}
                      onChange={(ev) => updateEdificio(idx, "pisos", Number(ev.target.value))}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-slate-500 mb-1 block">Aptos/piso</label>
                    <input
                      type="number" min="1"
                      value={e.unidadesPorPiso}
                      onChange={(ev) => updateEdificio(idx, "unidadesPorPiso", Number(ev.target.value))}
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
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Total: <strong>{totalUnidades}</strong> unidades en {edificios.length} torre{edificios.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Zonas comunes */}
          <div className="border-t border-slate-100 pt-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trees className="w-4 h-4 text-green-600" />
                <h3 className="font-bold text-slate-800 text-sm">Zonas comunes</h3>
              </div>
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

                {/* Zonas personalizadas ya seleccionadas */}
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

                {/* Agregar zona personalizada */}
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
              onClick={() => setStep(2)}
              disabled={!canProceed1}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 2: Espacios y tareas */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Espacios, fases y tareas</h2>

          {/* Espacios */}
          <div className="mb-6">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Espacios por unidad</h3>
            <div className="flex flex-wrap gap-2">
              {ESPACIOS_SUGERIDOS.map((esp) => (
                <button
                  key={esp}
                  onClick={() => toggleEspacio(esp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    espaciosSeleccionados.includes(esp)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {espaciosSeleccionados.includes(esp) && <Check className="w-3 h-3 inline mr-1" />}
                  {esp}
                </button>
              ))}
            </div>
          </div>

          {/* Fases */}
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

          {/* Generar tareas sugeridas + agregar personalizada */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={generarTareasSugeridas}
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Generar tareas sugeridas
            </button>
            <button
              onClick={() => {
                setShowAddTask(!showAddTask);
                if (!newTaskFase && fasesSeleccionadas.length > 0) setNewTaskFase(fasesSeleccionadas[0]);
                if (!newTaskEspacio && espaciosSeleccionados.length > 0) setNewTaskEspacio(espaciosSeleccionados[0]);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar tarea manual
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Genera tareas sugeridas o agrega las tuyas manualmente
          </p>

          {/* Custom task form */}
          {showAddTask && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-bold text-slate-800 mb-3">Nueva tarea</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Fase</label>
                  <select
                    value={newTaskFase}
                    onChange={(e) => setNewTaskFase(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    {fasesSeleccionadas.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Espacio</label>
                  <select
                    value={newTaskEspacio}
                    onChange={(e) => setNewTaskEspacio(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    {espaciosSeleccionados.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-slate-500 mb-1 block">Nombre de la tarea</label>
                  <input
                    value={newTaskNombre}
                    onChange={(e) => setNewTaskNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTask(); } }}
                    placeholder="Ej: Instalar mesón"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Días</label>
                  <input
                    type="number"
                    min="1"
                    value={newTaskDias}
                    onChange={(e) => setNewTaskDias(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={addCustomTask}
                disabled={!newTaskFase || !newTaskEspacio || !newTaskNombre.trim()}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar
              </button>
            </div>
          )}

          {/* Lista de tareas */}
          {tareas.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-100">
                {tareas.length} tareas por unidad
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {tareas.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50/50">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                      {t.fase === "Madera" ? "M" : "OB"}
                    </span>
                    <span className="text-[10px] text-slate-500 w-32 truncate flex-shrink-0">{t.espacio}</span>
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

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-4 py-2 rounded-xl text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceed2}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer"
            >
              Siguiente
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Asignar contratistas y revisar */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-4xl">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Resumen del proyecto</h2>
          <p className="text-sm text-slate-500 mb-5">
            Revisa los detalles y asigna contratistas a las tareas (opcional)
          </p>

          {/* Resumen */}
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500">Proyecto</div>
              <div className="text-sm font-bold text-slate-900 truncate">{nombre}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500">Unidades</div>
              <div className="text-sm font-bold text-slate-900">{totalUnidades}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500">Tareas totales</div>
              <div className="text-sm font-bold text-slate-900">{totalTareasGlobal}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><Building2 className="w-3 h-3" />Torres</div>
              <div className="text-sm font-bold text-slate-900">{edificios.length}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><Layers className="w-3 h-3" />Fases</div>
              <div className="text-sm font-bold text-slate-900">{fasesSeleccionadas.length}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />Días/sem</div>
              <div className="text-sm font-bold text-slate-900">{diasHabiles}</div>
            </div>
          </div>

          {/* Asignación de contratistas */}
          {contratistas.length > 0 ? (
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 text-sm mb-3">Asignar contratistas a tareas (opcional)</h3>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {tareas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-4 py-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                        {t.fase === "Madera" ? "M" : "OB"}
                      </span>
                      <span className="text-sm font-medium text-slate-800 flex-1 truncate">{t.nombre}</span>
                      <select
                        value={t.asignado_a ?? ""}
                        onChange={(e) => updateTareaAsignacion(t.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white max-w-[140px]"
                      >
                        <option value="">Sin asignar</option>
                        {contratistas.map((c) => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              No hay contratistas registrados. Puedes invitarlos después desde Usuarios y asignarlos a las tareas.
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold px-4 py-2 rounded-xl text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Atrás
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? "Creando proyecto..." : "Crear proyecto"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
