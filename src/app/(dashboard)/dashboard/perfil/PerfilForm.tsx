"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Building2,
  Loader2,
  Mail,
  Phone,
  Shield,
  User,
} from "lucide-react";

const nivelLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Administrador",
  DIRECTIVO: "Directivo",
  ADMIN_GENERAL: "Administrador general",
  ADMIN_PROYECTO: "Administrador de proyectos",
  CONTRATISTA: "Contratista",
  OBRERO: "Obrero",
};

interface PerfilFormProps {
  nombre: string;
  email: string;
  telefono: string | null;
  avatarUrl: string | null;
  rol: string;
  nivelAcceso: string;
  constructora: string;
}

export default function PerfilForm({
  nombre: initialNombre,
  email,
  telefono: initialTelefono,
  avatarUrl: initialAvatar,
  rol,
  nivelAcceso,
  constructora,
}: PerfilFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(initialNombre);
  const [telefono, setTelefono] = useState(initialTelefono ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const initials = nombre
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasChanges = nombre !== initialNombre || telefono !== (initialTelefono ?? "");

  async function handleAvatarUpload(file: File) {
    setUploadingAvatar(true);
    setError("");
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/perfil/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setAvatarUrl(data.url);
        router.refresh();
      } else {
        setError(data.error ?? "Error subiendo imagen");
      }
    } catch {
      setError("Error de red al subir imagen");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, telefono }),
      });
      if (res.ok) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error ?? "Error guardando");
      }
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Avatar + name header */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={nombre}
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-100"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-blue-500">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{nombre}</h2>
              <p className="text-sm text-slate-500">{email}</p>
            </div>
          </div>
        </div>

        {/* Role & org info (read-only) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Información organizacional</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Rol</p>
                <p className="text-sm font-medium text-slate-800">{rol}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Nivel de acceso</p>
                <p className="text-sm font-medium text-slate-800">{nivelLabels[nivelAcceso] ?? nivelAcceso}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Constructora</p>
                <p className="text-sm font-medium text-slate-800">{constructora}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Información personal</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                Nombre completo
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                <Mail className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                Email
              </label>
              <input
                value={email}
                disabled
                className="w-full px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                <Phone className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                Teléfono
              </label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +57 300 123 4567"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Cambios guardados
            </div>
          )}

          <div className="flex justify-end mt-5">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm cursor-pointer transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
