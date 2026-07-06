"use client";

import { Check } from "lucide-react";
import type { Opcion } from "./PasoOpciones";
import { CONTROL_EXCLUSIVO, CONTROL_OTRA_APP } from "./opciones";

const MAX_OTRA = 80; // acotado igual que el backend (control_otra)

/**
 * Grupo de opciones de selección MÚLTIPLE (checkboxes). Usado para la pregunta
 * de "¿cómo controlas hoy?" del onboarding.
 *
 * Reglas:
 *  - `CONTROL_EXCLUSIVO` ("No llevo control") es exclusivo: al marcarlo se
 *    desmarcan las demás; al marcar cualquier otra, se desmarca este.
 *  - Al marcar `CONTROL_OTRA_APP` ("Otra aplicación") aparece un campo de texto
 *    "¿Cuál?" OPCIONAL (no obligatorio para finalizar) que fluye a `control_otra`.
 */
export default function PasoOpcionesMulti({
  titulo,
  opciones,
  value,
  onChange,
  otra,
  onOtra,
  columnas = 1,
}: {
  titulo: string;
  opciones: Opcion[];
  /** Valores marcados. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Texto del campo "¿Cuál?" (solo relevante si OTRA_APP está marcada). */
  otra: string;
  onOtra: (v: string) => void;
  columnas?: 1 | 2;
}) {
  function toggle(v: string) {
    const marcada = value.includes(v);
    // Exclusividad de "No llevo control".
    if (v === CONTROL_EXCLUSIVO) {
      // Al marcar el exclusivo se desmarcan las demás; si "Otra aplicación"
      // estaba puesta con texto, ese texto ya no aplica → limpiarlo.
      if (!marcada && otra) onOtra("");
      onChange(marcada ? [] : [CONTROL_EXCLUSIVO]);
      return;
    }
    // Cualquier otra opción: al marcarla, quitar el exclusivo si estaba puesto.
    const base = value.filter((x) => x !== CONTROL_EXCLUSIVO);
    const next = marcada ? base.filter((x) => x !== v) : [...base, v];
    onChange(next);
    // Si se desmarca "Otra aplicación", limpiar el texto de "¿cuál?".
    if (v === CONTROL_OTRA_APP && marcada && otra) onOtra("");
  }

  const mostrarOtra = value.includes(CONTROL_OTRA_APP);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{titulo}</h3>
      <div className={columnas === 2 ? "grid gap-2.5 sm:grid-cols-2" : "grid gap-2.5"}>
        {opciones.map((op) => {
          const activa = value.includes(op.value);
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => toggle(op.value)}
              aria-pressed={activa}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                activa
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${
                  activa
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {activa && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium ${
                    activa ? "text-blue-900" : "text-slate-800"
                  }`}
                >
                  {op.label}
                </span>
                {op.desc && (
                  <span className="block text-xs text-slate-500 mt-0.5">{op.desc}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {mostrarOtra && (
        <div className="mt-3">
          <label
            htmlFor="control_otra"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            ¿Cuál? <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            id="control_otra"
            type="text"
            value={otra}
            onChange={(e) => onOtra(e.target.value.slice(0, MAX_OTRA))}
            maxLength={MAX_OTRA}
            placeholder="Ej: nombre de la aplicación"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 placeholder:text-slate-400"
          />
        </div>
      )}
    </div>
  );
}
