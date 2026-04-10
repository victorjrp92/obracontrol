"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Save, Loader2 } from "lucide-react";

export default function NotasEditor({
  tareaId,
  initialNotas,
}: {
  tareaId: string;
  initialNotas: string | null;
}) {
  const router = useRouter();
  const [notas, setNotas] = useState(initialNotas ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/tareas/${tareaId}/notas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas: notas.trim() || null }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } else {
      alert("Error guardando notas");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-slate-500" />
        <h3 className="font-bold text-slate-800">Notas</h3>
      </div>
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={3}
        placeholder="Agrega notas u observaciones..."
        className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        {saved && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
        <button
          onClick={handleSave}
          disabled={saving || notas === (initialNotas ?? "")}
          className="ml-auto inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {saving ? "Guardando..." : "Guardar nota"}
        </button>
      </div>
    </div>
  );
}
