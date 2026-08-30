"use client";

import { useState } from "react";
import { HardHat } from "lucide-react";

interface Obrero {
  id: string;
  nombre: string;
  cedula: string | null;
  especialidad: string | null;
  activo: boolean;
  scoreTotal: number;
  contratista: string;
  constructoraId: string;
  constructora: string;
}

interface Props {
  obreros: Obrero[];
  constructoras: { id: string; nombre: string }[];
}

export default function ObrerosClient({ obreros, constructoras }: Props) {
  const [filtro, setFiltro] = useState("");

  const filtered = filtro
    ? obreros.filter((o) => o.constructoraId === filtro)
    : obreros;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{filtered.length} obreros</p>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
        >
          <option value="">Todas las constructoras</option>
          {constructoras.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Personal de campo</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Cédula</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Especialidad</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Contratista</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Constructora</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Score</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                        <HardHat className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="font-medium text-slate-800">{o.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{o.cedula ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{o.especialidad ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{o.contratista}</td>
                  <td className="px-4 py-3 text-slate-600">{o.constructora}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-800">{o.scoreTotal.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {o.activo ? (
                      <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Activo</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    No hay personal de campo registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
