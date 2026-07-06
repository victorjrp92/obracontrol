"use client";

import { Check } from "lucide-react";

export interface Opcion {
  /** Valor exacto que viaja al backend (enum-string). */
  value: string;
  /** Texto visible, en lenguaje formal-cálido. */
  label: string;
  /** Descripción opcional bajo el título. */
  desc?: string;
}

/**
 * Grupo de opciones de clic (tarjetas seleccionables) de selección única.
 * Sin texto libre: el usuario solo elige. Reutilizable en cualquier pregunta
 * del wizard de onboarding.
 */
export default function PasoOpciones({
  titulo,
  opciones,
  value,
  onSelect,
  columnas = 1,
}: {
  titulo: string;
  opciones: Opcion[];
  value: string | null;
  onSelect: (value: string) => void;
  columnas?: 1 | 2;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-3">{titulo}</h3>
      <div
        className={
          columnas === 2
            ? "grid gap-2.5 sm:grid-cols-2"
            : "grid gap-2.5"
        }
      >
        {opciones.map((op) => {
          const activa = value === op.value;
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => onSelect(op.value)}
              aria-pressed={activa}
              className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                activa
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center ${
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
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {op.desc}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
