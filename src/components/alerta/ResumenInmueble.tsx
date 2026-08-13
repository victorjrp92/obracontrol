"use client";

import Link from "next/link";
import { ArrowRight, Download, Loader2, Plus } from "lucide-react";
import { evaluarInmueble } from "@/lib/alerta/reglas";
import { MAX_GRIETAS } from "@/lib/alerta/grietas";
import { LABEL_ELEMENTO } from "@/lib/alerta/copys";
import SemaforoNivel from "./SemaforoNivel";
import type { GrietaGuardada } from "./GrietaWizard";

interface ResumenInmuebleProps {
  grietas: GrietaGuardada[];
  terminado: boolean;
  presupuestoAgotado: boolean;
  generandoPdf: boolean;
  errorPdf: string | null;
  onAgregarOtra: () => void;
  onTerminar: () => void;
  onDescargarPdf: () => void;
}

/**
 * Paso 4 del triage: `evaluarInmueble(veredictos)` (nunca con lista vacía —
 * este componente solo se monta cuando `grietas.length > 0`, ver
 * GrietaWizard.tsx), lista de grietas evaluadas, "Agregar otra grieta"
 * (tope MAX_GRIETAS) / "Terminar", "Descargar informe en PDF", enlace a
 * /alerta/documentar.
 */
export default function ResumenInmueble({
  grietas,
  terminado,
  presupuestoAgotado,
  generandoPdf,
  errorPdf,
  onAgregarOtra,
  onTerminar,
  onDescargarPdf,
}: ResumenInmuebleProps) {
  const veredictoInmueble = evaluarInmueble(grietas.map((g) => g.evaluada.veredicto));
  const puedeAgregarOtra = !terminado && !presupuestoAgotado && grietas.length < MAX_GRIETAS;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Resultado del inmueble</h2>
          <SemaforoNivel nivel={veredictoInmueble.nivel} />
        </div>
        <p className="text-sm text-slate-600">{veredictoInmueble.que_hacer}</p>
      </div>

      <div className="flex flex-col gap-3">
        {grietas.map((g, i) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                Grieta {i + 1} — {LABEL_ELEMENTO[g.evaluada.reconciliacion.elemento]}
              </p>
              <p className="truncate text-xs text-slate-500">{g.evaluada.veredicto.razon}</p>
            </div>
            <SemaforoNivel nivel={g.evaluada.veredicto.nivel} tamano="sm" />
          </div>
        ))}
      </div>

      {puedeAgregarOtra && (
        <button
          type="button"
          onClick={onAgregarOtra}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
        >
          <Plus className="h-4 w-4" /> Agregar otra grieta ({grietas.length}/{MAX_GRIETAS})
        </button>
      )}
      {!terminado && !presupuestoAgotado && grietas.length >= MAX_GRIETAS && (
        <p className="text-xs text-amber-600">Llegaste al máximo de {MAX_GRIETAS} grietas por informe.</p>
      )}
      {!terminado && presupuestoAgotado && grietas.length < MAX_GRIETAS && (
        <p className="text-xs text-amber-600">Llegaste al peso máximo del informe. Descárgalo antes de agregar otra grieta.</p>
      )}

      {errorPdf && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorPdf}</p>}

      <button
        type="button"
        onClick={onDescargarPdf}
        disabled={generandoPdf}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {generandoPdf ? "Generando informe..." : "Descargar informe en PDF"}
      </button>

      {!terminado && (
        <button
          type="button"
          onClick={onTerminar}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          Terminar <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <Link href="/alerta/documentar" className="text-center text-xs font-medium text-blue-600 hover:text-blue-700">
        ¿También quieres documentar otros daños? Ve al acta de daños →
      </Link>
    </div>
  );
}
