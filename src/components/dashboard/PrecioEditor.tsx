"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Pencil, Save, X, Loader2 } from "lucide-react";

interface Props {
  tareaId: string;
  precioInicial: number | null;
  /** Si false, solo muestra el precio sin botón editar (para Obrero, etc.) */
  canEdit: boolean;
}

function formatCOP(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PrecioEditor({ tareaId, precioInicial, canEdit }: Props) {
  const router = useRouter();
  const [precio, setPrecio] = useState<number | null>(precioInicial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(precio != null ? String(precio) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const valorCrudo = draft.trim();
    let payload: number | null = null;
    if (valorCrudo !== "") {
      const n = Number(valorCrudo);
      if (!isFinite(n) || n < 0) {
        setError("Precio inválido");
        setSaving(false);
        return;
      }
      payload = n;
    }

    const res = await fetch(`/api/tareas/${tareaId}/precio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precio: payload }),
    });

    if (res.ok) {
      const data = await res.json();
      setPrecio(data.precio ?? null);
      setEditing(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  if (!canEdit) {
    return (
      <div className="inline-flex items-center gap-2 text-sm">
        <DollarSign className="w-4 h-4 text-slate-400" />
        <span className="font-semibold text-slate-700">{formatCOP(precio)}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">Precio de la tarea</span>
        </div>

        {!editing && (
          <button
            onClick={() => { setDraft(precio != null ? String(precio) : ""); setError(""); setEditing(true); }}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Pencil className="w-3.5 h-3.5" />
            {precio != null ? "Editar" : "Asignar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-500 mb-1">Precio en COP (vacío = sin precio)</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1000"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ej: 250000"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { setEditing(false); setError(""); }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
          {formatCOP(precio)}
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
