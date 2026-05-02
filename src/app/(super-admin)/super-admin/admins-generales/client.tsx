"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, User, Building2, Trash2 } from "lucide-react";

interface Admin {
  id: string;
  nombre: string;
  email: string;
  constructora: string;
  constructora_id: string;
}

interface Props {
  admins: Admin[];
  constructoras: { id: string; nombre: string }[];
  preselectConstructoraId: string;
}

export default function AdminsGeneralesClient({ admins, constructoras, preselectConstructoraId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [constructoraId, setConstructoraId] = useState(preselectConstructoraId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setTempPassword("");

    const form = new FormData(e.currentTarget);
    const body = {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      nombre: String(form.get("nombre") ?? "").trim(),
      constructora_id: constructoraId,
    };

    const res = await fetch("/api/super-admin/admins-generales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setSuccess(`Admin General creado: ${data.email}`);
      if (data.tempPassword) setTempPassword(data.tempPassword);
      (e.currentTarget as HTMLFormElement).reset();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Error al crear admin general");
    }
    setLoading(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-bold text-slate-900">Crear Admin General</h2>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {success}
            {tempPassword && (
              <div className="mt-2 font-mono text-xs bg-white border border-green-200 rounded px-2 py-1 select-all">
                Contraseña temporal: <b>{tempPassword}</b>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Nombre completo" icon={User}>
            <input
              name="nombre"
              type="text"
              required
              minLength={2}
              placeholder="Ej: Carlos Pérez"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            />
          </Field>

          <Field label="Correo electrónico" icon={Mail}>
            <input
              name="email"
              type="email"
              required
              placeholder="admin@empresa.com"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
            />
          </Field>

          <Field label="Constructora" icon={Building2}>
            <select
              required
              value={constructoraId}
              onChange={(e) => setConstructoraId(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 appearance-none bg-white cursor-pointer"
            >
              <option value="">Selecciona una constructora...</option>
              {constructoras.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          <button
            type="submit"
            disabled={loading || !constructoraId}
            className="mt-2 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Creando..." : "Crear Admin General"}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          Admin Generales existentes ({admins.length})
        </h2>
        {admins.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Aún no hay Admin Generales.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {admins.map((a) => (
              <div key={a.id} className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">{a.nombre}</div>
                    <div className="text-xs text-slate-500 truncate">{a.email}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Eliminar a ${a.nombre} (${a.email})?`)) return;
                      const res = await fetch(`/api/super-admin/usuarios/${a.id}`, { method: "DELETE" });
                      if (res.ok) router.refresh();
                      else {
                        const d = await res.json().catch(() => ({}));
                        alert(d.error ?? "Error al eliminar");
                      }
                    }}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 flex-shrink-0"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-red-600 font-semibold mt-1">📍 {a.constructora}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        {children}
      </div>
    </div>
  );
}
