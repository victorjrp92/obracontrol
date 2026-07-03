"use client";

// ─────────────────────────────────────────────────────────────────────────
// Panel "Descargar plantilla + Subir Excel" (B2C, paso "¿Qué te falta?").
// Solo CASA/APARTAMENTO/LOCAL y solo al CREAR una obra (en edición no se
// muestra). La estructura (espacios por piso) se arma en el wizard y se manda
// SIEMPRE al parser para validar ubicaciones.
// ─────────────────────────────────────────────────────────────────────────

import { useRef, useState } from "react";
import { Download, Upload, Loader2, FileSpreadsheet, Info } from "lucide-react";
import type { EstructuraPlantilla } from "@/lib/plantilla-obra";
import type { PreviewImport } from "./import-excel-types";

export default function ImportExcelPanel({
  estructura,
  puedeDescargar,
  onRevisar,
}: {
  estructura: EstructuraPlantilla;
  /** false si aún no hay espacios (deshabilita la descarga). */
  puedeDescargar: boolean;
  onRevisar: (preview: PreviewImport) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [descargando, setDescargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  async function descargar() {
    if (!puedeDescargar) return;
    setError("");
    setDescargando(true);
    try {
      const res = await fetch("/api/plantilla-obra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(estructura),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "No pudimos generar la plantilla.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-obra.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos generar la plantilla.");
    } finally {
      setDescargando(false);
    }
  }

  async function subir(archivo: File) {
    setError("");
    setSubiendo(true);
    try {
      const form = new FormData();
      form.append("archivo", archivo);
      form.append("estructura", JSON.stringify(estructura));
      const res = await fetch("/api/plantilla-obra/parse", { method: "POST", body: form });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error ?? "No pudimos leer el archivo.");
      }
      onRevisar(j as PreviewImport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">¿Ya tienes un presupuesto en Excel?</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Descarga la plantilla con tus espacios, pégale tus tareas y montos, y súbela.
            Nosotros la revisamos contigo antes de agregar nada.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={descargar}
          disabled={!puedeDescargar || descargando}
          className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Descargar plantilla Excel
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-60 disabled:cursor-wait shadow-sm shadow-blue-600/20"
        >
          {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {subiendo ? "Leyendo…" : "Subir Excel lleno"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subir(f);
          }}
        />
      </div>

      {!puedeDescargar && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0" /> Primero agrega tus espacios para poder descargar la plantilla.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
