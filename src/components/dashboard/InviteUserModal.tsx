"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, UserPlus, Mail, User, Shield } from "lucide-react";
import ProyectosMultiSelect from "@/components/dashboard/ProyectosMultiSelect";

interface RolOption {
  id: string;
  nombre: string;
  nivel_acceso: string;
}

interface ProyectoOption {
  id: string;
  nombre: string;
}

interface Props {
  onClose: () => void;
  proyectos?: ProyectoOption[];
}

export default function InviteUserModal({ onClose, proyectos = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roles, setRoles] = useState<RolOption[]>([]);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [proyectosAsignados, setProyectosAsignados] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRoles(data as RolOption[]);
      })
      .catch(() => {});
  }, []);

  const selectedRol = roles.find((r) => r.id === selectedRolId);
  const needsProyectos = selectedRol?.nivel_acceso === "ADMIN_PROYECTO";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      email: form.get("email"),
      nombre: form.get("nombre"),
      rol_id: selectedRolId,
    };

    if (needsProyectos) {
      if (proyectosAsignados.length === 0) {
        setError("Selecciona al menos un proyecto");
        setLoading(false);
        return;
      }
      body.proyectos_asignados = proyectosAsignados;
    }

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.refresh();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al invitar usuario");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Invitar usuario</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Nombre completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="nombre" type="text" required placeholder="Nombre del usuario"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                name="email" type="email" required placeholder="usuario@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Rol</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                required
                value={selectedRolId}
                onChange={(e) => setSelectedRolId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 appearance-none bg-white cursor-pointer"
              >
                <option value="">Seleccionar rol...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {needsProyectos && (
            <ProyectosMultiSelect
              proyectos={proyectos}
              value={proyectosAsignados}
              onChange={setProyectosAsignados}
              required
            />
          )}

          <p className="text-xs text-slate-500">
            Se enviará un email con contraseña temporal al usuario invitado.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "Invitando..." : "Enviar invitación"}
          </button>
        </form>
      </div>
    </div>
  );
}
