"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, X, Loader2, Clock, Building2, User } from "lucide-react";

interface Sugerencia {
  id: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  estado: "PENDIENTE" | "APROBADA" | "RECHAZADA";
  motivo_rechazo: string | null;
  unidades: string[];
  created_at: string;
  contratista: { id: string; nombre: string; email: string };
  proyecto: { id: string; nombre: string };
  revisor: { id: string; nombre: string } | null;
}

interface Fase {
  id: string;
  nombre: string;
}

interface AprobarModalProps {
  sugerencia: Sugerencia;
  fases: Fase[];
  onClose: () => void;
}

function AprobarModal({ sugerencia, fases, onClose }: AprobarModalProps) {
  const router = useRouter();
  const [tiempoAcordadoDias, setTiempoAcordadoDias] = useState(5);
  const [faseId, setFaseId] = useState(fases[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAprobar() {
    setError("");
    if (!faseId) {
      setError("Selecciona una fase");
      return;
    }
    if (tiempoAcordadoDias < 1) {
      setError("El tiempo debe ser al menos 1 día");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sugerencias/${sugerencia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "APROBADA",
          tiempo_acordado_dias: tiempoAcordadoDias,
          fase_id: faseId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error aprobando sugerencia");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error aprobando sugerencia");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Aprobar sugerencia
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Aprobando: <strong>{sugerencia.nombre}</strong> en{" "}
          <strong>{sugerencia.proyecto.nombre}</strong>
        </p>
        <p className="text-xs text-slate-500 mb-5">
          Se crearán {sugerencia.unidades.length} tarea{sugerencia.unidades.length !== 1 ? "s" : ""} asignadas a {sugerencia.contratista.nombre}.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Fase del proyecto <span className="text-red-500">*</span>
            </label>
            {fases.length === 0 ? (
              <p className="text-xs text-slate-400">No hay fases configuradas en este proyecto.</p>
            ) : (
              <select
                value={faseId}
                onChange={(e) => setFaseId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              >
                {fases.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Tiempo acordado (días hábiles) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={tiempoAcordadoDias}
              onChange={(e) => setTiempoAcordadoDias(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAprobar}
              disabled={loading || fases.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {loading ? "Aprobando..." : "Aprobar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RechazarModalProps {
  sugerencia: Sugerencia;
  onClose: () => void;
}

function RechazarModal({ sugerencia, onClose }: RechazarModalProps) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRechazar() {
    setError("");
    if (motivo.trim().length < 5) {
      setError("El motivo debe tener al menos 5 caracteres");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sugerencias/${sugerencia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "RECHAZADA",
          motivo_rechazo: motivo,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error rechazando sugerencia");
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error rechazando sugerencia");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            Rechazar sugerencia
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          Rechazando: <strong>{sugerencia.nombre}</strong>
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Explica por qué no se aprueba esta sugerencia..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRechazar}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {loading ? "Rechazando..." : "Rechazar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { label: "Pendientes", value: "PENDIENTE" },
  { label: "Aprobadas", value: "APROBADA" },
  { label: "Rechazadas", value: "RECHAZADA" },
  { label: "Todas", value: "ALL" },
] as const;

const BADGE: Record<string, { label: string; className: string }> = {
  PENDIENTE: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APROBADA: { label: "Aprobada", className: "bg-green-50 text-green-700 border-green-200" },
  RECHAZADA: { label: "Rechazada", className: "bg-red-50 text-red-700 border-red-200" },
};

interface SugerenciasPanelProps {
  sugerencias: Sugerencia[];
  fasesMap: Record<string, Fase[]>; // keyed by proyecto_id
  initialTab: string;
}

export default function SugerenciasPanel({
  sugerencias,
  fasesMap,
  initialTab,
}: SugerenciasPanelProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [aprobarTarget, setAprobarTarget] = useState<Sugerencia | null>(null);
  const [rechazarTarget, setRechazarTarget] = useState<Sugerencia | null>(null);

  const filtered =
    activeTab === "ALL"
      ? sugerencias
      : sugerencias.filter((s) => s.estado === activeTab);

  return (
    <>
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((tab) => {
          const count =
            tab.value === "ALL"
              ? sugerencias.length
              : sugerencias.filter((s) => s.estado === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === tab.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center">
          <p className="text-sm text-slate-400">No hay sugerencias en esta categoría.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((s) => {
            const badge = BADGE[s.estado] ?? { label: s.estado, className: "" };
            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-start gap-4"
              >
                {/* Thumbnail */}
                {s.foto_url && (
                  <div className="w-full sm:w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                    <img
                      src={s.foto_url}
                      alt="Foto sugerencia"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {s.nombre}
                    </h3>
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {s.descripcion && (
                    <p className="text-xs text-slate-500 mb-2 line-clamp-2">{s.descripcion}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {s.proyecto.nombre}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {s.contratista.nombre}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(s.created_at).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-slate-400">
                      {s.unidades.length} unidad{s.unidades.length !== 1 ? "es" : ""}
                    </span>
                  </div>

                  {s.estado === "RECHAZADA" && s.motivo_rechazo && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-xs font-medium text-red-700">Motivo de rechazo:</p>
                      <p className="text-xs text-red-600">{s.motivo_rechazo}</p>
                    </div>
                  )}

                  {s.revisor && s.estado !== "PENDIENTE" && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Revisado por {s.revisor.nombre}
                    </p>
                  )}
                </div>

                {/* Actions (only for PENDIENTE) */}
                {s.estado === "PENDIENTE" && (
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setAprobarTarget(s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRechazarTarget(s)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {aprobarTarget && (
        <AprobarModal
          sugerencia={aprobarTarget}
          fases={fasesMap[aprobarTarget.proyecto.id] ?? []}
          onClose={() => setAprobarTarget(null)}
        />
      )}

      {rechazarTarget && (
        <RechazarModal
          sugerencia={rechazarTarget}
          onClose={() => setRechazarTarget(null)}
        />
      )}
    </>
  );
}
