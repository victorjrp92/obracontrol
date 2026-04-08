"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function AprobarButtons({ tareaId }: { tareaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"aprobar" | "rechazar" | null>(null);
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [justificacion, setJustificacion] = useState("");

  async function handleAprobar() {
    setLoading("aprobar");
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "APROBADA" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error al aprobar");
    }
    setLoading(null);
  }

  async function handleNoAprobar() {
    if (!showJustificacion) {
      setShowJustificacion(true);
      return;
    }
    setLoading("rechazar");
    const res = await fetch(`/api/tareas/${tareaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: "NO_APROBADA",
        justificacion_por_item: { motivo: justificacion || "Sin justificación" },
      }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Error");
    }
    setLoading(null);
    setShowJustificacion(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleAprobar}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {loading === "aprobar" ? "Aprobando..." : "Aprobar"}
        </button>
        <button
          onClick={handleNoAprobar}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          {loading === "rechazar" ? "Enviando..." : "No aprobar"}
        </button>
      </div>
      {showJustificacion && (
        <textarea
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          placeholder="Justificación (por qué no se aprueba)..."
          className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
          rows={3}
        />
      )}
    </div>
  );
}
