"use client";

import { useState } from "react";
import { ArrowRight, BrickWall, Columns3, Grid2x2, HelpCircle, LayoutPanelTop, PanelLeft, Rows2, type LucideIcon } from "lucide-react";
import { IconBox } from "@/components/personal/icons";
import type { Elemento } from "@/lib/alerta/tipos";

interface OpcionElemento {
  elemento: Elemento;
  label: string;
  Icon: LucideIcon;
}

// Siete tarjetas en lenguaje llano (spec sección 3). `fachada` y
// `nudo_viga_columna` solo son alcanzables desde el lado del modelo — no
// aparecen aquí.
const OPCIONES: OpcionElemento[] = [
  { elemento: "columna", label: "Columna", Icon: Columns3 },
  { elemento: "viga", label: "Viga", Icon: Rows2 },
  { elemento: "muro_carga", label: "Muro que sostiene la casa", Icon: BrickWall },
  { elemento: "muro_divisorio", label: "Muro divisorio", Icon: PanelLeft },
  { elemento: "losa_techo", label: "Techo o losa", Icon: LayoutPanelTop },
  { elemento: "piso", label: "Piso", Icon: Grid2x2 },
  { elemento: "no_determinado", label: "No estoy seguro", Icon: HelpCircle },
];

interface UbicarGrietaProps {
  onSeleccionar: (elemento: Elemento) => void;
}

/** Paso 1 del triage: elegir dónde está la grieta. Nada preseleccionado (spec sección 3). */
export default function UbicarGrieta({ onSeleccionar }: UbicarGrietaProps) {
  const [seleccionado, setSeleccionado] = useState<Elemento | null>(null);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">¿Dónde está la grieta?</h2>
        <p className="mt-1 text-sm text-slate-500">Elige lo que más se parezca a lo que ves.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {OPCIONES.map((op) => (
          <button
            key={op.elemento}
            type="button"
            onClick={() => setSeleccionado(op.elemento)}
            aria-pressed={seleccionado === op.elemento}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
              seleccionado === op.elemento ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <IconBox Icon={op.Icon} active={seleccionado === op.elemento} />
            <span className="text-sm font-semibold text-slate-800">{op.label}</span>
          </button>
        ))}
      </div>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <strong>¿No sabes si es &ldquo;muro que sostiene la casa&rdquo; o &ldquo;muro divisorio&rdquo;?</strong> El
        primero suele ser más grueso y hace parte de la estructura; el divisorio solo separa espacios. Si
        tienes dudas, elige &ldquo;No estoy seguro&rdquo; — así no se subestima el resultado.
      </p>

      <button
        type="button"
        onClick={() => seleccionado && onSeleccionar(seleccionado)}
        disabled={!seleccionado}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Siguiente <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
