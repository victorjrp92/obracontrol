"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertTriangle, Loader2 } from "lucide-react";

interface RetrasoModalProps {
  tareaId: string;
  onClose: () => void;
}

const TIPOS = [
  {
    value: "POR_FALTA_PISTA",
    label: "Por falta de pista de la obra",
    descripcion: "La obra no completó trabajos previos. Requiere evidencia. NO afecta el score del contratista.",
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  {
    value: "POR_CONTRATISTA",
    label: "Por contratista",
    descripcion: "Retraso atribuible al contratista. Afecta el score.",
    color: "bg-red-50 border-red-200 text-red-700",
  },
  {
    value: "OTRO",
    label: "Otro motivo",
    descripcion: "Otra causa de retraso. Afecta el score.",
    color: "bg-orange-50 border-orange-200 text-orange-700",
  },
];

export default function RetrasoModal({ tareaId, onClose }: RetrasoModalProps) {
  const router = useRouter();
  const [tipo, setTipo] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [evidenciaUrls, setEvidenciaUrls] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!tipo) {
      setError("Selecciona el tipo de retraso");
      return;
    }
    if (justificacion.trim().length < 10) {
      setError("La justificación debe tener al menos 10 caracteres");
      return;
    }
    if (tipo === "POR_FALTA_PISTA" && evidenciaUrls.trim().length === 0) {
      setError("Retraso por falta de pista requiere evidencia (URLs o descripción)");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/retrasos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarea_id: tareaId,
        tipo,
        justificacion,
        evidencia_urls: evidenciaUrls
          ? evidenciaUrls.split("\n").map((s) => s.trim()).filter(Boolean)
          : [],
      }),
    });

    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error registrando retraso");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Registrar retraso
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
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Tipo de retraso</label>
            <div className="flex flex-col gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    tipo === t.value
                      ? `${t.color} border-current`
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-900">{t.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{t.descripcion}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Justificación <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              rows={4}
              placeholder="Describe el motivo del retraso..."
              className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          {tipo === "POR_FALTA_PISTA" && (
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Evidencia (descripciones o links) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={evidenciaUrls}
                onChange={(e) => setEvidenciaUrls(e.target.value)}
                rows={3}
                placeholder="Una entrada por línea. Ej: 'Cocina sin instalación eléctrica' o link a foto"
                className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Una entrada por línea. Puedes pegar URLs de fotos ya subidas.
              </p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {loading ? "Registrando..." : "Registrar retraso"}
          </button>
        </div>
      </div>
    </div>
  );
}
