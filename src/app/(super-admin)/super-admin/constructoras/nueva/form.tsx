"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

export default function NuevaConstructoraForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      nombre: form.get("nombre"),
      nit: form.get("nit") || null,
      ciudad: form.get("ciudad") || null,
      direccion: form.get("direccion") || null,
      telefono: form.get("telefono") || null,
      sitio_web: form.get("sitio_web") || null,
      plan_suscripcion: form.get("plan_suscripcion") || "OBRA",
    };

    const res = await fetch("/api/super-admin/constructoras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const created = await res.json();
      router.push(`/super-admin/constructoras/${created.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al crear constructora");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-bold text-slate-900">Datos de la empresa</h2>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <Input name="nombre" label="Nombre de la constructora *" required />
      <div className="grid grid-cols-2 gap-3">
        <Input name="nit" label="NIT" />
        <Input name="ciudad" label="Ciudad" />
      </div>
      <Input name="direccion" label="Dirección" />
      <div className="grid grid-cols-2 gap-3">
        <Input name="telefono" label="Teléfono" />
        <Input name="sitio_web" label="Sitio web" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Plan de suscripción</label>
        <select
          name="plan_suscripcion"
          defaultValue="OBRA"
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
        >
          <option value="OBRA">OBRA</option>
          <option value="PROYECTO">PROYECTO</option>
          <option value="EMPRESA">EMPRESA</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
      >
        {loading ? "Creando..." : "Crear constructora"}
      </button>
    </form>
  );
}

function Input({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        name={name}
        required={required}
        className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
      />
    </div>
  );
}
