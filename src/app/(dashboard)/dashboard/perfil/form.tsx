"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Building2, Shield, Save, Calendar } from "lucide-react";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  nivel_acceso: string;
  constructora: string;
  created_at: string;
}

const NIVEL_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  DIRECTIVO: "Directivo",
  ADMIN_GENERAL: "Admin General",
  ADMIN_PROYECTO: "Admin Junior",
  CONTRATISTA: "Contratista",
  OBRERO: "Obrero",
};

export default function PerfilForm({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(usuario.nombre);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const initials = nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const cambios = nombre.trim() !== usuario.nombre.trim();

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/usuarios/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim() }),
    });
    if (res.ok) {
      setSuccess("Perfil actualizado");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-bold text-lg text-slate-900 truncate">{usuario.nombre}</div>
          <div className="text-sm text-slate-500 truncate">{usuario.email}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded">
              <Shield className="w-3 h-3" />
              {NIVEL_LABEL[usuario.nivel_acceso] ?? usuario.nivel_acceso}
            </span>
            <span className="text-xs text-slate-500">· {usuario.rol}</span>
          </div>
        </div>
      </div>

      {/* Editable */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Información personal</h2>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
        )}

        <div className="flex flex-col gap-3">
          <Field label="Nombre completo" icon={User}>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              minLength={2}
              maxLength={100}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </Field>

          <Field label="Correo electrónico (no editable)" icon={Mail}>
            <input
              value={usuario.email}
              readOnly
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </Field>

          <button
            onClick={handleSave}
            disabled={saving || !cambios || nombre.trim().length < 2}
            className="mt-2 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : cambios ? "Guardar cambios" : "Sin cambios"}
          </button>
        </div>
      </div>

      {/* Read-only */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Cuenta</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <ReadField icon={Building2} label="Empresa" value={usuario.constructora} />
          <ReadField icon={Shield} label="Rol" value={usuario.rol} />
          <ReadField
            icon={Calendar}
            label="Miembro desde"
            value={new Date(usuario.created_at).toLocaleDateString("es-CO", {
              day: "numeric", month: "long", year: "numeric",
            })}
          />
        </dl>
        <p className="text-[11px] text-slate-400 mt-3">
          Para cambiar tu rol, empresa o email, contacta al administrador del sistema.
        </p>
      </div>
    </div>
  );
}

function Field({
  label, icon: Icon, children,
}: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
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

function ReadField({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
      <div className="min-w-0">
        <dt className="text-[11px] text-slate-500">{label}</dt>
        <dd className="font-semibold text-slate-800 truncate">{value}</dd>
      </div>
    </div>
  );
}
