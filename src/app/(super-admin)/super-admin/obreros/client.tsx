"use client";

import { useState, useMemo } from "react";
import { Search, Star, Trophy, Filter } from "lucide-react";
import { ESPECIALIDADES, ESPECIALIDAD_LABEL } from "@/lib/obrero";

interface ObreroRow {
  id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  especialidad: string | null;
  eps: string | null;
  arl: string | null;
  anos_experiencia: number | null;
  activo: boolean;
  fecha_expiracion: string;
  contratista: string;
  constructora: string;
  score_total: number;
  score_calidad: number;
  score_velocidad: number;
  score_cumplimiento: number;
  evidencias_aprobadas: number;
  evidencias_rechazadas: number;
  tareas_completadas: number;
  evidencias_total: number;
}

export default function ObrerosRankingClient({ obreros }: { obreros: ObreroRow[] }) {
  const [search, setSearch] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [constructora, setConstructora] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);

  const constructoras = useMemo(
    () => Array.from(new Set(obreros.map((o) => o.constructora))).sort(),
    [obreros],
  );

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return obreros.filter((o) => {
      if (soloActivos && (!o.activo || new Date(o.fecha_expiracion) < new Date())) return false;
      if (especialidad && o.especialidad !== especialidad) return false;
      if (constructora && o.constructora !== constructora) return false;
      if (!term) return true;
      return [o.nombre, o.cedula, o.contratista, o.especialidad, o.telefono, o.constructora]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term));
    });
  }, [obreros, search, especialidad, constructora, soloActivos]);

  const top3 = filtered.slice(0, 3);

  return (
    <>
      {top3.length > 0 && top3.some((o) => o.score_total > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {top3.map((o, idx) => (
            <TopCard key={o.id} pos={idx + 1} obrero={o} />
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula, contratista, constructora..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
          />
        </div>
        <select
          value={constructora}
          onChange={(e) => setConstructora(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">Todas las constructoras</option>
          {constructoras.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={especialidad}
          onChange={(e) => setEspecialidad(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
        >
          <option value="">Todas las especialidades</option>
          {ESPECIALIDADES.map((e) => (
            <option key={e} value={e}>{ESPECIALIDAD_LABEL[e]}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white cursor-pointer">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="rounded"
          />
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          Solo activos
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Obrero</th>
                <th className="px-4 py-3 font-medium">Especialidad</th>
                <th className="px-4 py-3 font-medium">Constructora</th>
                <th className="px-4 py-3 font-medium">Contratista</th>
                <th className="px-4 py-3 font-medium text-center">Score</th>
                <th className="px-4 py-3 font-medium text-center">Evidencias</th>
                <th className="px-4 py-3 font-medium text-center">Tareas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-10">
                    No hay obreros que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filtered.map((o, idx) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{o.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {o.cedula ? `CC ${o.cedula}` : "Sin cédula"} ·{" "}
                        {o.telefono ?? "Sin tel"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.especialidad ? (
                        <span className="inline-block text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                          {ESPECIALIDAD_LABEL[o.especialidad as keyof typeof ESPECIALIDAD_LABEL] ?? o.especialidad}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                      {o.anos_experiencia != null && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{o.anos_experiencia} años exp.</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-medium">{o.constructora}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{o.contratista}</td>
                    <td className="px-4 py-3 text-center">
                      <ScoreCell score={o.score_total} />
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="text-green-600 font-semibold">{o.evidencias_aprobadas}</span>
                      <span className="text-slate-300 mx-0.5">/</span>
                      <span className="text-red-600 font-semibold">{o.evidencias_rechazadas}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 font-semibold">
                      {o.tareas_completadas}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function TopCard({ pos, obrero: o }: { pos: number; obrero: ObreroRow }) {
  const colors = ["bg-yellow-50 border-yellow-200", "bg-slate-50 border-slate-200", "bg-orange-50 border-orange-200"];
  const trophyColor = ["text-yellow-500", "text-slate-400", "text-orange-500"];
  return (
    <div className={`rounded-2xl border p-4 ${colors[pos - 1] ?? "bg-white"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Trophy className={`w-5 h-5 ${trophyColor[pos - 1] ?? ""}`} />
        <span className="text-xs font-bold text-slate-700">#{pos}</span>
      </div>
      <div className="font-bold text-slate-800 truncate">{o.nombre}</div>
      <div className="text-xs text-slate-500 truncate">{o.constructora}</div>
      <div className="text-[10px] text-slate-400 truncate">
        {o.especialidad ? ESPECIALIDAD_LABEL[o.especialidad as keyof typeof ESPECIALIDAD_LABEL] : "Sin especialidad"}
      </div>
      <div className="flex items-center gap-1 mt-2">
        <Star className={`w-4 h-4 fill-current ${trophyColor[pos - 1] ?? ""}`} />
        <span className="text-2xl font-bold text-slate-800">{o.score_total}</span>
      </div>
    </div>
  );
}

function ScoreCell({ score }: { score: number }) {
  if (score === 0) return <span className="text-xs text-slate-400">Sin calificar</span>;
  const color = score >= 80 ? "text-green-600 bg-green-50" : score >= 60 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${color}`}>
      <Star className="w-3 h-3 fill-current" /> {score}
    </span>
  );
}
