"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

const MIN_JUSTIFICACION = 5;

export default function AprobarButtons({
  tareaId,
  canApprove = true,
}: {
  tareaId: string;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"aprobar" | "rechazar" | null>(null);
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [justificacion, setJustificacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const justificacionTrim = justificacion.trim();
  const justificacionValida = justificacionTrim.length >= MIN_JUSTIFICACION;

  async function handleAprobar() {
    setLoading("aprobar");
    setError(null);
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "APROBADA" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al aprobar");
    }
    setLoading(null);
  }

  function abrirRechazo() {
    setShowJustificacion(true);
    setError(null);
  }

  function cancelarRechazo() {
    setShowJustificacion(false);
    setJustificacion("");
    setError(null);
  }

  async function confirmarRechazo() {
    if (!justificacionValida) {
      setError(`Escribe al menos ${MIN_JUSTIFICACION} caracteres explicando el motivo`);
      return;
    }
    setLoading("rechazar");
    setError(null);
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "NO_APROBADA",
        justificacion_por_item: { motivo: justificacionTrim },
      }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al rechazar");
    }
    setLoading(null);
    setShowJustificacion(false);
    setJustificacion("");
  }

  if (showJustificacion) {
    return (
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-slate-700">
          Motivo del rechazo <span className="text-red-600">*</span>
        </label>
        <textarea
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          placeholder="Indica qué hace falta o qué debe corregirse. El personal de campo verá este mensaje al reenviar la tarea."
          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
          rows={3}
          autoFocus
          disabled={loading !== null}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{justificacionTrim.length}/{MIN_JUSTIFICACION} mínimo</span>
          {error && <span className="text-red-600">{error}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={confirmarRechazo}
            disabled={loading !== null || !justificacionValida}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            {loading === "rechazar" ? "Enviando..." : "Confirmar rechazo"}
          </button>
          <button
            onClick={cancelarRechazo}
            disabled={loading !== null}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleAprobar}
          disabled={loading !== null || !canApprove}
          title={!canApprove ? "Se requieren al menos 2 fotos" : undefined}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {loading === "aprobar" ? "Aprobando..." : "Aprobar"}
        </button>
        <button
          onClick={abrirRechazo}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          No aprobar
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
