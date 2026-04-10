"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Calendar, Loader2 } from "lucide-react";

export default function ExtensionModal({
  tareaId,
  onClose,
}: {
  tareaId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [diasAdicionales, setDiasAdicionales] = useState(1);
  const [justificacion, setJustificacion] = useState("");
  const [documentacion, setDocumentacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (justificacion.trim().length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/extensiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarea_id: tareaId,
        dias_adicionales: diasAdicionales,
        justificacion,
        documentacion_url: documentacion,
      }),
    });
    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error solicitando extensión");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Solicitar extensión de tiempo
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Días adicionales <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={diasAdicionales}
              onChange={(e) => setDiasAdicionales(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
            <p className="text-xs text-slate-500 mt-1">
              Se sumarán al tiempo acordado de la tarea
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Justificación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={4}
              placeholder="Razón de la extensión (ej: retraso en suministro de piezas)"
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Documentación de soporte (opcional)
            </label>
            <input
              type="text"
              value={documentacion}
              onChange={(e) => setDocumentacion(e.target.value)}
              placeholder="URL del documento o descripción"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {loading ? "Solicitando..." : "Autorizar extensión"}
          </button>
        </div>
      </div>
    </div>
  );
}
