"use client";

import { useState } from "react";
import { useRef } from "react";
import {
  ArrowRight, Check, ChevronDown, ChevronRight, Download, Plus, Ruler, Trash2, Trees, Upload,
} from "lucide-react";
import { ESPACIOS_SUGERIDOS, ZONAS_COMUNES_SUGERIDAS } from "@/lib/task-templates";
import type { TipoUnidadInput, EdificioInput, UnidadDetailInput, Contratista, UbicacionInput } from "./wizard-types";
import LocationPicker from "@/components/mapa/LocationPicker";

interface WizardStep1Props {
  nombre: string;
  setNombre: (v: string) => void;
  numeroRegistro: string;
  setNumeroRegistro: (v: string) => void;
  contratistaDefaultId: string;
  setContratistaDefaultId: (v: string) => void;
  contratistas: Contratista[];
  clienteId: string;
  setClienteId: (v: string) => void;
  clientes: { id: string; nombre: string }[];
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  setSubtipo: (v: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES") => void;
  diasHabiles: number;
  setDiasHabiles: (v: number) => void;
  fechaInicio: string;
  setFechaInicio: (v: string) => void;
  fechaFin: string;
  setFechaFin: (v: string) => void;
  ubicacion: UbicacionInput | null;
  setUbicacion: (v: UbicacionInput | null) => void;
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
  numeroRegistro, setNumeroRegistro,
  contratistaDefaultId, setContratistaDefaultId,
  contratistas,
  clienteId, setClienteId,
  clientes,
  subtipo, setSubtipo,
  diasHabiles, setDiasHabiles,
  fechaInicio, setFechaInicio,
  fechaFin, setFechaFin,
  ubicacion, setUbicacion,
  tiposUnidad, setTiposUnidad,
  edificios, setEdificios,
  tieneZonasComunes, setTieneZonasComunes,
  zonasSeleccionadas, setZonasSeleccionadas,
  metrosEnabled, onMetrosEnabledChange,
  metrosZonas, onMetrosZonasChange,
  canProceed, onNext,
}: WizardStep1Props) {
  const [customSpaceInputs, setCustomSpaceInputs] = useState<Record<string, string>>({});
  const [zonaPersonalizada, setZonaPersonalizada] = useState("");
  const [numericStrings, setNumericStrings] = useState<Record<string, string>>({});
  const [detalleExpandido, setDetalleExpandido] = useState<Record<number, boolean>>({});
  const [pisosExpandidos, setPisosExpandidos] = useState<Record<string, boolean>>({});
  const excelInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // --- Tipo management ---
  function addTipoUnidad() {
    const newId = `t${Date.now()}`;
    const newTipo: TipoUnidadInput = { id: newId, nombre: `Tipo ${tiposUnidad.length + 1}`, espacios: [] };
    setTiposUnidad([...tiposUnidad, newTipo]);
    setEdificios(edificios.map((e) => ({ ...e, distribucion: { ...e.distribucion, [newId]: { derecha: 0, izquierda: 0 } } })));
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
    const defaultPisos = 5;
    const defaultUpiso = 4;
    const totalUnits = defaultPisos * defaultUpiso;
    const perTipo = tiposUnidad.length > 0 ? Math.floor(totalUnits / tiposUnidad.length) : 0;
    const half = Math.floor(perTipo / 2);
    const dist: Record<string, import("./wizard-types").DistribucionSentido> = {};
    tiposUnidad.forEach((t) => { dist[t.id] = { derecha: half, izquierda: perTipo - half }; });
    setEdificios([...edificios, { nombre: `Torre ${edificios.length + 1}`, pisos: defaultPisos, unidades_por_piso: defaultUpiso, distribucion: dist }]);
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
    next[idx] = { ...next[idx], pisos, unidades_detalle: undefined };
    setEdificios(next);
  }

  function updateEdificioDistribucion(idx: number, tipoId: string, sentido: "derecha" | "izquierda", count: number) {
    const next = [...edificios];
    const prev = next[idx].distribucion[tipoId] ?? { derecha: 0, izquierda: 0 };
    next[idx] = { ...next[idx], distribucion: { ...next[idx].distribucion, [tipoId]: { ...prev, [sentido]: count } }, unidades_detalle: undefined };
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
    return acc + e.pisos * getUnidadesPorPiso(e);
  }, 0);

  function generateUnidadesDetalle(e: EdificioInput): Record<number, UnidadDetailInput[]> {
    const udsPerFloor = e.unidades_por_piso ?? 0;
    if (udsPerFloor === 0 || e.pisos === 0) return {};

    // Build a flat list of all units for the tower from the distribution (torre totals)
    const allUnits: { tipo_unidad_id: string; sentido: "derecha" | "izquierda" }[] = [];
    for (const tipo of tiposUnidad) {
      const dist = e.distribucion[tipo.id] ?? { derecha: 0, izquierda: 0 };
      for (let i = 0; i < dist.derecha; i++) allUnits.push({ tipo_unidad_id: tipo.id, sentido: "derecha" });
      for (let i = 0; i < dist.izquierda; i++) allUnits.push({ tipo_unidad_id: tipo.id, sentido: "izquierda" });
    }

    const result: Record<number, UnidadDetailInput[]> = {};
    let unitIdx = 0;
    for (let piso = 1; piso <= e.pisos; piso++) {
      const units: UnidadDetailInput[] = [];
      for (let slot = 0; slot < udsPerFloor; slot++) {
        const src = allUnits[unitIdx];
        units.push({
          nombre: `${piso}0${slot + 1}`,
          tipo_unidad_id: src?.tipo_unidad_id ?? tiposUnidad[0]?.id ?? "",
          sentido: src?.sentido ?? "derecha",
        });
        unitIdx++;
      }
      result[piso] = units;
    }
    return result;
  }

  function toggleDetalleEdificio(idx: number) {
    const next = { ...detalleExpandido, [idx]: !detalleExpandido[idx] };
    setDetalleExpandido(next);
    if (next[idx] && !edificios[idx].unidades_detalle) {
      const updated = [...edificios];
      updated[idx] = { ...updated[idx], unidades_detalle: generateUnidadesDetalle(updated[idx]) };
      setEdificios(updated);
    }
  }

  function togglePisoExpandido(edIdx: number, piso: number) {
    const key = `${edIdx}-${piso}`;
    setPisosExpandidos((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateUnidadDetalle(edIdx: number, piso: number, uIdx: number, field: string, value: string) {
    const updated = [...edificios];
    const detalle = { ...(updated[edIdx].unidades_detalle ?? {}) };
    const pisoUnits = [...(detalle[piso] ?? [])];
    pisoUnits[uIdx] = { ...pisoUnits[uIdx], [field]: value };
    detalle[piso] = pisoUnits;
    updated[edIdx] = { ...updated[edIdx], unidades_detalle: detalle };
    setEdificios(updated);
  }

  function buildFloorSummary(e: EdificioInput, piso: number): string {
    const detalle = e.unidades_detalle ?? generateUnidadesDetalle(e);
    const units = detalle[piso] ?? [];
    const counts: Record<string, { d: number; i: number }> = {};
    for (const u of units) {
      if (!counts[u.tipo_unidad_id]) counts[u.tipo_unidad_id] = { d: 0, i: 0 };
      if (u.sentido === "derecha") counts[u.tipo_unidad_id].d++;
      else counts[u.tipo_unidad_id].i++;
    }
    const parts: string[] = [];
    for (const tipo of tiposUnidad) {
      const c = counts[tipo.id];
      if (c && (c.d + c.i) > 0) parts.push(`${c.d + c.i} ${tipo.nombre} (${c.d}D/${c.i}I)`);
    }
    return `Piso ${piso}: ${parts.join(", ") || "sin unidades"}`;
  }

  function getUnidadesPorPiso(e: EdificioInput): number {
    return e.unidades_por_piso ?? 0;
  }

  function getDistribucionSum(e: EdificioInput): number {
    return Object.values(e.distribucion).reduce((s, d) => s + d.derecha + d.izquierda, 0);
  }

  function updateUnidadesPorPiso(idx: number, total: number) {
    const updated = [...edificios];
    updated[idx] = { ...updated[idx], unidades_por_piso: total, unidades_detalle: undefined };
    setEdificios(updated);
  }

  async function downloadDetalleExcel(idx: number) {
    const e = edificios[idx];
    const detalle = e.unidades_detalle ?? generateUnidadesDetalle(e);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Detalle " + e.nombre);

    ws.columns = [
      { header: "Piso", key: "piso", width: 8 },
      { header: "Apto", key: "apto", width: 12 },
      { header: "Tipo", key: "tipo", width: 20 },
      { header: "Sentido", key: "sentido", width: 14 },
    ];
    ws.getRow(1).font = { bold: true };

    for (let p = 1; p <= e.pisos; p++) {
      const units = detalle[p] ?? [];
      for (const u of units) {
        const tipoNombre = tiposUnidad.find((t) => t.id === u.tipo_unidad_id)?.nombre ?? u.tipo_unidad_id;
        ws.addRow({ piso: p, apto: u.nombre, tipo: tipoNombre, sentido: u.sentido });
      }
    }

    // Add data validation for Tipo and Sentido columns
    const tipoNames = tiposUnidad.map((t) => t.nombre);
    const lastRow = ws.rowCount;
    if (lastRow > 1) {
      for (let r = 2; r <= lastRow; r++) {
        ws.getCell(`C${r}`).dataValidation = { type: "list", formulae: [`"${tipoNames.join(",")}"`] };
        ws.getCell(`D${r}`).dataValidation = { type: "list", formulae: ['"derecha,izquierda"'] };
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detalle_${e.nombre.replace(/\s+/g, "_")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadDetalleExcel(idx: number, file: File) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return;

    const tipoNameToId: Record<string, string> = {};
    for (const t of tiposUnidad) tipoNameToId[t.nombre.toLowerCase()] = t.id;

    const result: Record<number, UnidadDetailInput[]> = {};
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const piso = Number(row.getCell(1).value) || 0;
      const apto = String(row.getCell(2).value ?? "").trim();
      const tipoRaw = String(row.getCell(3).value ?? "").trim();
      const sentidoRaw = String(row.getCell(4).value ?? "").trim().toLowerCase();
      if (!piso || !apto) return;

      const tipoId = tipoNameToId[tipoRaw.toLowerCase()] ?? tiposUnidad[0]?.id ?? "";
      const sentido: "derecha" | "izquierda" = sentidoRaw === "izquierda" ? "izquierda" : "derecha";

      if (!result[piso]) result[piso] = [];
      result[piso].push({ nombre: apto, tipo_unidad_id: tipoId, sentido });
    });

    const updated = [...edificios];
    updated[idx] = { ...updated[idx], unidades_detalle: result };
    setEdificios(updated);
    setDetalleExpandido((prev) => ({ ...prev, [idx]: true }));
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 max-w-3xl">
      <h2 className="text-lg font-bold text-slate-900 mb-5">Informacion del proyecto</h2>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Nombre del proyecto</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proyecto Olivo"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
          >
            <option value="">Sin cliente asignado</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Gestiona clientes en <a href="/dashboard/configuracion/clientes" className="font-semibold underline" target="_blank">Configuración</a>.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Número de registro <span className="text-red-500">*</span>
          </label>
          <input
            value={numeroRegistro}
            onChange={(e) => setNumeroRegistro(e.target.value)}
            placeholder="Ej: PR-2026-001"
            maxLength={40}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Único por empresa. Las tareas heredarán este número (ej. PR-2026-001-T0001).
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Contratista por defecto
          </label>
          <select
            value={contratistaDefaultId}
            onChange={(e) => setContratistaDefaultId(e.target.value)}
            disabled={contratistas.length === 0}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {contratistas.length === 0 ? "No hay contratistas registrados" : "Selecciona un contratista..."}
            </option>
            {contratistas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.rol_ref?.nombre ? `· ${c.rol_ref.nombre}` : ""}
              </option>
            ))}
          </select>
          {contratistas.length === 0 ? (
            <p className="text-[11px] text-amber-700 mt-1.5">
              Aún no tienes contratistas creados. Dirígete a <a href="/dashboard/usuarios" className="font-semibold underline">Usuarios</a> y crea al menos uno con rol Contratista antes de continuar.
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 mt-1">
              Se asignará automáticamente a las tareas del proyecto que no tengan contratista específico. Vinculado al proyecto {numeroRegistro || "(número)"}.
            </p>
          )}
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
            <option value={5}>5 días (lun-vie)</option>
            <option value={5.5}>5.5 días (lun-sáb medio día)</option>
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

      {/* Ubicación del proyecto (opcional) — alimenta el mapa */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">
          Ubicación de la obra <span className="text-slate-400 font-normal">(opcional)</span>
        </label>
        <LocationPicker value={ubicacion} onChange={setUbicacion} />
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
                    <div className="w-28">
                      <label className="text-xs text-slate-500 mb-1 block">Uds/piso</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={getNumericDisplay(`e${idx}:upiso`, getUnidadesPorPiso(e))}
                        onChange={(ev) => handleNumericChange(`e${idx}:upiso`, ev.target.value, (n) => updateUnidadesPorPiso(idx, Math.max(1, n)))}
                        onBlur={() => handleNumericBlur(`e${idx}:upiso`, getUnidadesPorPiso(e))}
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
                  <div className="flex flex-wrap gap-3">
                    {tiposUnidad.map((tipo) => {
                      const dist = e.distribucion[tipo.id] ?? { derecha: 0, izquierda: 0 };
                      const keyD = `e${idx}:dist:${tipo.id}:d`;
                      const keyI = `e${idx}:dist:${tipo.id}:i`;
                      return (
                        <div key={tipo.id} className="flex items-center gap-1.5">
                          <label className="text-xs text-slate-600 font-medium">{tipo.nombre}:</label>
                          <span className="text-[10px] text-slate-400">Der</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={getNumericDisplay(keyD, dist.derecha)}
                            onChange={(ev) => handleNumericChange(keyD, ev.target.value, (n) => updateEdificioDistribucion(idx, tipo.id, "derecha", n))}
                            onBlur={() => handleNumericBlur(keyD, dist.derecha)}
                            className="w-12 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                          <span className="text-[10px] text-slate-400">Izq</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={getNumericDisplay(keyI, dist.izquierda)}
                            onChange={(ev) => handleNumericChange(keyI, ev.target.value, (n) => updateEdificioDistribucion(idx, tipo.id, "izquierda", n))}
                            onBlur={() => handleNumericBlur(keyI, dist.izquierda)}
                            className="w-12 px-2 py-1 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                          />
                          <span className="text-[11px] text-slate-400">total</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Distribution mismatch warning */}
                  {e.unidades_por_piso != null && e.unidades_por_piso > 0 && getDistribucionSum(e) !== e.pisos * e.unidades_por_piso && (
                    <p className="mt-2 text-[11px] text-amber-600 font-medium">
                      La distribución suma {getDistribucionSum(e)} unidades pero el total de la torre es {e.pisos * e.unidades_por_piso} ({e.pisos} pisos × {e.unidades_por_piso} uds/piso). Ajústala para que coincida.
                    </p>
                  )}

                  {/* Per-floor summary */}
                  <div className="mt-2 space-y-0.5">
                    {Array.from({ length: Math.min(e.pisos, 3) }, (_, i) => i + 1).map((piso) => (
                      <p key={piso} className="text-[11px] text-slate-500">
                        {buildFloorSummary(e, piso)}
                      </p>
                    ))}
                    {e.pisos > 3 && (
                      <p className="text-[11px] text-slate-400 italic">
                        ...y {e.pisos - 3} piso{e.pisos - 3 !== 1 ? "s" : ""} más con la misma distribución
                      </p>
                    )}
                  </div>

                  {/* Expandable detail section */}
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDetalleEdificio(idx)}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {detalleExpandido[idx] ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        Ver detalle por piso
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDetalleExcel(idx)}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Descargar Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => excelInputRefs.current[idx]?.click()}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Upload className="w-3 h-3" />
                        Subir Excel
                      </button>
                      <input
                        ref={(el) => { excelInputRefs.current[idx] = el; }}
                        type="file"
                        accept=".xlsx"
                        className="hidden"
                        onChange={(ev) => {
                          const file = ev.target.files?.[0];
                          if (file) uploadDetalleExcel(idx, file);
                          ev.target.value = "";
                        }}
                      />
                    </div>

                    {detalleExpandido[idx] && e.unidades_detalle && (
                      <div className="mt-2 space-y-1">
                        {Array.from({ length: e.pisos }, (_, i) => i + 1).map((piso) => {
                          const pisoKey = `${idx}-${piso}`;
                          const isOpen = pisosExpandidos[pisoKey];
                          const unidades = e.unidades_detalle?.[piso] ?? [];
                          return (
                            <div key={piso} className="rounded-lg border border-slate-200 bg-white">
                              <button
                                type="button"
                                onClick={() => togglePisoExpandido(idx, piso)}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                              >
                                <span>Piso {piso} ({unidades.length} unidades)</span>
                                {isOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>

                              {isOpen && (
                                <div className="px-3 pb-2">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-[10px] text-slate-400 uppercase">
                                        <th className="text-left py-1 font-medium">Apto</th>
                                        <th className="text-left py-1 font-medium">Tipo</th>
                                        <th className="text-left py-1 font-medium">Sentido</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {unidades.map((unidad, uIdx) => (
                                        <tr key={uIdx} className="border-t border-slate-100">
                                          <td className="py-1 pr-2">
                                            <input
                                              type="text"
                                              value={unidad.nombre}
                                              onChange={(ev) => updateUnidadDetalle(idx, piso, uIdx, "nombre", ev.target.value)}
                                              className="w-16 px-1.5 py-0.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400"
                                            />
                                          </td>
                                          <td className="py-1 pr-2">
                                            <select
                                              value={unidad.tipo_unidad_id}
                                              onChange={(ev) => updateUnidadDetalle(idx, piso, uIdx, "tipo_unidad_id", ev.target.value)}
                                              className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                                            >
                                              {tiposUnidad.map((t) => (
                                                <option key={t.id} value={t.id}>{t.nombre}</option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="py-1">
                                            <select
                                              value={unidad.sentido}
                                              onChange={(ev) => updateUnidadDetalle(idx, piso, uIdx, "sentido", ev.target.value)}
                                              className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
                                            >
                                              <option value="derecha">Derecha</option>
                                              <option value="izquierda">Izquierda</option>
                                            </select>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 mt-3">
              Total: <strong>{totalUnidades}</strong> unidades en {edificios.length} torre{edificios.length !== 1 ? "s" : ""}
              {tiposUnidad.length > 1 && (
                <> ({tiposUnidad.map((t) => {
                  const count = edificios.reduce((acc, e) => {
                    const d = e.distribucion[t.id] ?? { derecha: 0, izquierda: 0 };
                    return acc + d.derecha + d.izquierda;
                  }, 0);
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

      <div className="flex flex-col items-end gap-2 mt-6">
        {!canProceed && (() => {
          const missing: string[] = [];
          if (nombre.trim().length < 3) missing.push("Nombre del proyecto (mín. 3 caracteres)");
          if (numeroRegistro.trim().length < 2) missing.push("Número de registro (mín. 2 caracteres)");
          // contratistaDefaultId is optional
          const tiposSinEspacios = tiposUnidad.filter((t) => t.espacios.length === 0).map((t) => t.nombre || "Tipo sin nombre");
          if (tiposSinEspacios.length > 0) missing.push(`Espacios para: ${tiposSinEspacios.join(", ")}`);
          if (subtipo === "ZONAS_COMUNES") {
            if (zonasSeleccionadas.length === 0) missing.push("Selecciona al menos una zona común");
          } else {
            if (edificios.length === 0) missing.push("Agrega al menos una torre");
            const torresIncompletas = edificios.filter((e) => !e.nombre || e.pisos <= 0 || (e.unidades_por_piso ?? 0) <= 0);
            if (torresIncompletas.length > 0) missing.push(`Completa nombre, pisos y uds/piso de: ${torresIncompletas.map((e) => e.nombre || "torre sin nombre").join(", ")}`);
            const torresDescuadradas = edificios.filter((e) => {
              const upiso = e.unidades_por_piso ?? 0;
              if (upiso <= 0 || e.pisos <= 0) return false;
              const distSum = Object.values(e.distribucion).reduce((s, d) => s + (d.derecha ?? 0) + (d.izquierda ?? 0), 0);
              return distSum !== e.pisos * upiso;
            });
            if (torresDescuadradas.length > 0) {
              const detalle = torresDescuadradas.map((e) => {
                const upiso = e.unidades_por_piso ?? 0;
                const distSum = Object.values(e.distribucion).reduce((s, d) => s + (d.derecha ?? 0) + (d.izquierda ?? 0), 0);
                return `${e.nombre || "torre"} (suma ${distSum}, esperado ${e.pisos * upiso})`;
              }).join("; ");
              missing.push(`Distribución descuadrada en: ${detalle}`);
            }
          }
          if (missing.length === 0) return null;
          return (
            <div className="w-full max-w-md text-right">
              <p className="text-[11px] text-slate-500 mb-1">Para continuar, completa:</p>
              <ul className="text-[12px] text-amber-700 space-y-0.5">
                {missing.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </div>
          );
        })()}
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
