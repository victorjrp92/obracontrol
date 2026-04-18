"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Shield, Pencil, Check, X } from "lucide-react";
import InviteUserModal from "@/components/dashboard/InviteUserModal";
import ProyectosMultiSelect from "@/components/dashboard/ProyectosMultiSelect";

interface UserRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rol_id: string;
  rolLabel: string;
  created_at: string;
}

interface RolOption {
  id: string;
  nombre: string;
  nivel_acceso: string;
}

interface Props {
  usuarios: UserRow[];
  roles: RolOption[];
  proyectos?: { id: string; nombre: string }[];
  canInviteAnyRole?: boolean;
}

export default function UsuariosClient({ usuarios, roles, proyectos, canInviteAnyRole }: Props) {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProyectoIds, setSelectedProyectoIds] = useState<string[]>([]);

  // Derived: the RolOption currently selected in the edit dropdown
  const selectedRol = roles.find((r) => r.id === selectedRolId);

  async function handleSaveRole(userId: string) {
    if (!selectedRolId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol_id: selectedRolId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al cambiar rol");
      } else {
        router.refresh();
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  }

  function startEditing(user: UserRow) {
    setEditingId(user.id);
    setSelectedRolId(user.rol_id);
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Invitar usuario</span>
          <span className="sm:hidden">Invitar</span>
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Nombre</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Desde</span>
          <span>Acciones</span>
        </div>
        {usuarios.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-800">{u.nombre}</span>
            </div>
            <span className="text-sm text-slate-500 truncate">{u.email}</span>
            {editingId === u.id ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedRolId}
                  onChange={(e) => setSelectedRolId(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded-lg border border-blue-300 bg-white focus:ring-2 focus:ring-blue-500/30 min-w-[140px]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre} ({r.nivel_acceso.toLowerCase()})</option>
                  ))}
                </select>
                {selectedRol?.nivel_acceso === "ADMIN_PROYECTO" && proyectos && proyectos.length > 0 && (
                  <ProyectosMultiSelect
                    proyectos={proyectos}
                    selected={selectedProyectoIds}
                    onChange={setSelectedProyectoIds}
                  />
                )}
                <button
                  onClick={() => handleSaveRole(u.id)}
                  disabled={saving}
                  className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                <Shield className="w-3 h-3" />
                {u.rolLabel}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
            </span>
            {editingId !== u.id && (
              <button
                onClick={() => startEditing(u)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                title="Cambiar rol"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {editingId === u.id && <span />}
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {usuarios.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{u.nombre}</div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
              {editingId !== u.id && (
                <button
                  onClick={() => startEditing(u)}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingId === u.id ? (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRolId}
                    onChange={(e) => setSelectedRolId(e.target.value)}
                    className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-blue-300 bg-white"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.nombre} ({r.nivel_acceso.toLowerCase()})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSaveRole(u.id)}
                    disabled={saving}
                    className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {selectedRol?.nivel_acceso === "ADMIN_PROYECTO" && proyectos && proyectos.length > 0 && (
                  <ProyectosMultiSelect
                    proyectos={proyectos}
                    selected={selectedProyectoIds}
                    onChange={setSelectedProyectoIds}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" />
                  {u.rolLabel}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          proyectos={proyectos}
          canInviteAnyRole={canInviteAnyRole}
        />
      )}
    </main>
  );
}
