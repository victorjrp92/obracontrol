"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { LABEL_PATRON, ORDEN_PATRON } from "@/lib/alerta/copys";
import type { Banderas, Patron } from "@/lib/alerta/tipos";

/**
 * Formulario de modo manual (spec D4): se usa cuando no hay IA disponible,
 * la llamada falla, o el usuario elige "prefiero describirla yo". Pieza no
 * nombrada explícitamente en la lista de archivos del plan, pero requerida
 * por D4 ("patrón desde un menú ilustrado, banderas como sí/no") — separada
 * en su propio componente en vez de vivir dentro de GrietaWizard.tsx, mismo
 * criterio de un archivo por responsabilidad que el resto de `alerta/`.
 *
 * NO pregunta por el elemento: eso ya se preguntó en el Paso 1
 * (UbicarGrieta.tsx) y GrietaWizard.tsx lo reusa tal cual como `elemento`
 * de la ObservacionGrieta manual (fuente: "manual", ver triage.ts T4).
 *
 * Las etiquetas del menú de patrones ya NO viven acá: se movieron tal cual a
 * `LABEL_PATRON`/`ORDEN_PATRON` en `src/lib/alerta/copys.ts` para que el
 * paso de confirmación de patrón (R3, `ConfirmarPatron.tsx`) use exactamente
 * las mismas palabras. Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md.
 */

interface PreguntaBandera {
  clave: keyof Banderas;
  texto: string;
}

const PREGUNTAS_BANDERAS: PreguntaBandera[] = [
  { clave: "acero_expuesto", texto: "¿Se ve el hierro (varilla) por dentro de la grieta?" },
  { clave: "concreto_triturado", texto: "¿El concreto se ve triturado o desmoronado ahí?" },
  { clave: "desplazamiento_caras", texto: "¿Un lado de la grieta quedó más alto o más adelante que el otro, como un escalón?" },
  { clave: "elemento_inclinado", texto: "¿El elemento (columna, muro) se ve inclinado?" },
  { clave: "separacion_muro_estructura", texto: "¿El muro se separó de la columna o viga (se ve un hueco entre los dos)?" },
];

const BANDERAS_INICIALES: Banderas = {
  acero_expuesto: false,
  concreto_triturado: false,
  desplazamiento_caras: false,
  elemento_inclinado: false,
  separacion_muro_estructura: false,
};

interface DescribirGrietaManualProps {
  onCompletar: (datos: { patron: Patron; banderas: Banderas }) => void;
}

export default function DescribirGrietaManual({ onCompletar }: DescribirGrietaManualProps) {
  const [patron, setPatron] = useState<Patron | null>(null);
  const [banderas, setBanderas] = useState<Banderas>(BANDERAS_INICIALES);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Descríbenos la grieta</h2>
        <p className="mt-1 text-xs text-slate-500">No pudimos leer la foto automáticamente. Cuéntanos lo que ves.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">¿Cómo se ve la grieta?</p>
        <div className="flex flex-col gap-2">
          {ORDEN_PATRON.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setPatron(op)}
              aria-pressed={patron === op}
              className={`rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                patron === op ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {LABEL_PATRON[op]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">Responde sí o no:</p>
        <div className="flex flex-col divide-y divide-slate-100">
          {PREGUNTAS_BANDERAS.map((p) => (
            <div key={p.clave} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-700">{p.texto}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBanderas((prev) => ({ ...prev, [p.clave]: true }))}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                    banderas[p.clave] ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setBanderas((prev) => ({ ...prev, [p.clave]: false }))}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                    !banderas[p.clave] ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => patron && onCompletar({ patron, banderas })}
        disabled={!patron}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continuar <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
