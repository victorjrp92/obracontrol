"use client";

import { useState } from "react";
import { ArrowRight, Check, Pencil } from "lucide-react";
import { LABEL_ELEMENTO, LABEL_PATRON, ORDEN_PATRON } from "@/lib/alerta/copys";
import type { Elemento, Patron } from "@/lib/alerta/tipos";

/**
 * R3 — paso de confirmación humana del PATRÓN, entre la lectura de la IA y
 * el veredicto. El elemento ya tenía dos fuentes (lo que marcó la persona en
 * el Paso 1 y lo que leyó el modelo) y se reconcilian; el patrón venía de
 * una sola fuente y nadie lo contrastaba — y el patrón es lo que abre la
 * única puerta al verde (regla 8: muro divisorio + craquelado).
 *
 * Muestra en lenguaje llano lo que se leyó y deja confirmar o corregir. Las
 * etiquetas son EXACTAMENTE las del menú del modo manual
 * (`LABEL_PATRON`/`ORDEN_PATRON` en `src/lib/alerta/copys.ts`) — no se
 * inventa vocabulario nuevo para la misma pregunta.
 *
 * Lo que devuelve va a `EntradaTriage.patron_declarado`: si difiere del
 * observado, `triage.ts` baja `confianza.patron` a 0 y evalúa también el
 * patrón corregido, quedándose con el nivel más severo.
 *
 * Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md.
 */
interface ConfirmarPatronProps {
  /** Elemento leído en la foto (solo para redactar la frase; el veredicto lo reconcilia triage.ts). */
  elementoLeido: Elemento;
  /** Patrón leído en la foto por el modelo. */
  patronLeido: Patron;
  /** Nota de la IA ya sanitizada — null si el filtro de lenguaje la descartó. */
  notaVisual: string | null;
  onConfirmar: (patron: Patron) => void;
}

export default function ConfirmarPatron({ elementoLeido, patronLeido, notaVisual, onConfirmar }: ConfirmarPatronProps) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [seleccionado, setSeleccionado] = useState<Patron | null>(null);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Antes del resultado, confírmanos una cosa</h2>
        <p className="mt-1 text-xs text-slate-500">
          Así no dependemos solo de lo que la foto alcanzó a mostrar.
        </p>
      </div>

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          Leímos: una grieta <strong className="text-slate-900">&ldquo;{LABEL_PATRON[patronLeido]}&rdquo;</strong> en{" "}
          <strong className="text-slate-900">&ldquo;{LABEL_ELEMENTO[elementoLeido]}&rdquo;</strong>.
        </p>
        {notaVisual && (
          <p className="mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Lo que se ve en la foto: </span>
            {notaVisual}
          </p>
        )}
      </div>

      {!corrigiendo ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onConfirmar(patronLeido)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Check className="h-4 w-4" /> Sí, así se ve
          </button>
          <button
            type="button"
            onClick={() => setCorrigiendo(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> No, se ve distinta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-slate-800">¿Cómo se ve la grieta?</p>
          <div className="flex flex-col gap-2">
            {ORDEN_PATRON.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => setSeleccionado(op)}
                aria-pressed={seleccionado === op}
                className={`rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  seleccionado === op
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {LABEL_PATRON[op]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => seleccionado && onConfirmar(seleccionado)}
            disabled={!seleccionado}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
