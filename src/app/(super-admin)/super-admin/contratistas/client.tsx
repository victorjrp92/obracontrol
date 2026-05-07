"use client";

import { useState } from "react";
import { Briefcase } from "lucide-react";

interface Contratista {
  id: string;
  nombre: string;
  email: string;
  constructoraId: string;
  constructora: string;
  scoreTotal: number;
  scoreCumplimiento: number;
  scoreCalidad: number;
  scoreVelocidad: number;
  tareasAprobadas: number;
  tareasPendientes: number;
}

interface Props {
  contratistas: Contratista[];
  constructoras: { id: string; nombre: string }[];
}

export default function ContratistasClient({ contratistas, constructoras }: Props) {
  const [filtro, setFiltro] = useState("");

  const filtered = filtro
    ? contratistas.filter((c) => c.constructoraId === filtro)
    : contratistas;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{filtered.length} contratistas</p>
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
                <th className="px-4 py-3 font-semibold text-slate-600">Contratista</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Constructora</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Score</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Cumplimiento</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Calidad</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Aprobadas</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Pendientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{c.nombre}</div>
                        <div className="text-xs text-slate-400 truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.constructora}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-800">{c.scoreTotal.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.scoreCumplimiento.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.scoreCalidad.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-green-50 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">{c.tareasAprobadas}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">{c.tareasPendientes}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    No hay contratistas registrados.
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
