"use client";

import { MapPin } from "lucide-react";
import { NOMBRES_DEPARTAMENTOS, municipiosDe } from "@/lib/colombia-divipola";

/**
 * Selector en cascada Departamento → Municipio (DIVIPOLA).
 * Al elegir departamento se cargan sus municipios; si se cambia el departamento
 * se limpia el municipio para no dejar una pareja incoherente.
 *
 * Componente controlado: el wizard es dueño del estado.
 */
export default function SelectorUbicacion({
  departamento,
  ciudad,
  onChange,
}: {
  departamento: string;
  ciudad: string;
  onChange: (next: { departamento: string; ciudad: string }) => void;
}) {
  const municipios = departamento ? municipiosDe(departamento) : [];

  const SELECT_CLS =
    "w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-slate-900 disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Departamento
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            className={SELECT_CLS}
            value={departamento}
            onChange={(e) =>
              // Al cambiar de departamento, el municipio anterior deja de ser válido.
              onChange({ departamento: e.target.value, ciudad: "" })
            }
          >
            <option value="">Selecciona tu departamento</option>
            {NOMBRES_DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Ciudad o municipio
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            className={SELECT_CLS}
            value={ciudad}
            disabled={!departamento}
            onChange={(e) => onChange({ departamento, ciudad: e.target.value })}
          >
            <option value="">
              {departamento ? "Selecciona tu municipio" : "Elige primero un departamento"}
            </option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
