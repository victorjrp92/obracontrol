"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Shield, Pencil, Check, X, Mail } from "lucide-react";
import InviteUserModal from "@/components/dashboard/InviteUserModal";
import AddContratistaModal from "@/components/dashboard/AddContratistaModal";
import ProyectosMultiSelect from "@/components/dashboard/ProyectosMultiSelect";

interface UserRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rol_id: string;
  nivel_acceso: string;
  rolLabel: string;
  invitado: boolean;
  created_at: string;
  proyectos_ids?: string[];
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
  const [showAddContratista, setShowAddContratista] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRolId, setSelectedRolId] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProyectoIds, setSelectedProyectoIds] = useState<string[]>([]);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  // Editing fields for uninvited contratistas
  const [editNombre, setEditNombre] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Derived: the RolOption currently selected in the edit dropdown
  const selectedRol = roles.find((r) => r.id === selectedRolId);

  async function handleSaveRole(userId: string) {
    if (!selectedRolId) return;

    const user = usuarios.find((u) => u.id === userId);
    const isUninvitedEdit = user && !user.invitado;

    if (!isUninvitedEdit) {
      const nextRol = roles.find((r) => r.id === selectedRolId);
      if (nextRol?.nivel_acceso === "ADMIN_PROYECTO" && selectedProyectoIds.length === 0) {
        alert("Un Admin Proyecto debe tener al menos un proyecto asignado");
        return;
      }
    }

    setSaving(true);
    try {
      if (isUninvitedEdit) {
        // For uninvited contratistas, update nombre and email via PATCH
        const body: { rol_id: string; nombre?: string; email?: string } = { rol_id: selectedRolId };
        if (editNombre.trim()) body.nombre = editNombre.trim();
        if (editEmail.trim()) body.email = editEmail.trim();

        const res = await fetch(`/api/usuarios/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Error al guardar cambios");
        } else {
          router.refresh();
        }
      } else {
        const body: { rol_id: string; proyectos_asignados?: string[] } = { rol_id: selectedRolId };
        const nextRol = roles.find((r) => r.id === selectedRolId);
        if (nextRol?.nivel_acceso === "ADMIN_PROYECTO") {
          body.proyectos_asignados = selectedProyectoIds;
        }
        const res = await fetch(`/api/usuarios/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Error al cambiar rol");
        } else {
          router.refresh();
        }
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
    setSelectedProyectoIds(user.proyectos_ids ?? []);
    setEditNombre(user.nombre);
    setEditEmail(user.email);
  }

  async function handleSendInvite(userId: string) {
    if (!confirm("Se creará la cuenta de acceso y se enviará un email con contraseña temporal. ¿Continuar?")) return;
    setSendingInvite(userId);
    try {
      const res = await fetch(`/api/usuarios/${userId}/invitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Error al enviar invitación");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSendingInvite(null);
    }
  }

  // Render the editing UI for uninvited contratistas (nombre + email editable)
  function renderUninvitedEditDesktop(u: UserRow) {
    return (
      <>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border border-green-300 bg-white focus:ring-2 focus:ring-green-500/30 w-full min-w-[120px]"
            placeholder="Nombre"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="text-sm px-2 py-1.5 rounded-lg border border-green-300 bg-white focus:ring-2 focus:ring-green-500/30 w-full min-w-[160px]"
            placeholder="Email"
          />
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          <Shield className="w-3 h-3" />
          {u.rolLabel}
        </span>
        <span className="text-xs text-slate-400">
          {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
        </span>
        <div className="flex items-center gap-1">
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
      </>
    );
  }

  // Render the standard editing UI (role dropdown)
  function renderStandardEditDesktop(u: UserRow) {
    return (
      <>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
            {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-800">{u.nombre}</span>
        </div>
        <span className="text-sm text-slate-500 truncate">{u.email}</span>
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
              value={selectedProyectoIds}
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
        <span className="text-xs text-slate-400">
          {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
        </span>
        <span />
      </>
    );
  }

  // Render actions column for non-editing rows
  function renderActionsDesktop(u: UserRow) {
    return (
      <div className="flex items-center gap-1">
        {!u.invitado && (
          <button
            onClick={() => handleSendInvite(u.id)}
            disabled={sendingInvite === u.id}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"
            title="Enviar invitación"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => startEditing(u)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
          title={u.invitado ? "Cambiar rol" : "Editar contratista"}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-slate-500">{usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddContratista(true)}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar contratista</span>
            <span className="sm:hidden">Contratista</span>
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Invitar usuario</span>
            <span className="sm:hidden">Invitar</span>
          </button>
        </div>
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
        {usuarios.map((u) => {
          const isEditing = editingId === u.id;
          const isUninvited = !u.invitado;
          const isUninvitedEditing = isEditing && isUninvited;

          if (isUninvitedEditing) {
            return (
              <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 bg-green-50/30 items-center">
                {renderUninvitedEditDesktop(u)}
              </div>
            );
          }

          if (isEditing) {
            return (
              <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
                {renderStandardEditDesktop(u)}
              </div>
            );
          }

          return (
            <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isUninvited ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                  {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">{u.nombre}</span>
                  {isUninvited && (
                    <span className="text-[10px] text-amber-600 font-medium">Sin invitación</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-500 truncate">{u.email}</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                <Shield className="w-3 h-3" />
                {u.rolLabel}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
              </span>
              {renderActionsDesktop(u)}
            </div>
          );
        })}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3">
        {usuarios.map((u) => {
          const isEditing = editingId === u.id;
          const isUninvited = !u.invitado;

          return (
            <div key={u.id} className={`bg-white rounded-xl border border-slate-100 p-4 ${isUninvited && !isEditing ? "border-l-4 border-l-amber-300" : ""}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isUninvited ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                  {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing && isUninvited ? (
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        className="text-sm px-2 py-1 rounded-lg border border-green-300 bg-white focus:ring-2 focus:ring-green-500/30 w-full"
                        placeholder="Nombre"
                      />
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border border-green-300 bg-white focus:ring-2 focus:ring-green-500/30 w-full"
                        placeholder="Email"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-slate-800 truncate">{u.nombre}</div>
                      <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      {isUninvited && (
                        <span className="text-[10px] text-amber-600 font-medium">Sin invitación</span>
                      )}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isEditing && isUninvited && (
                    <button
                      onClick={() => handleSendInvite(u.id)}
                      disabled={sendingInvite === u.id}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50"
                      title="Enviar invitación"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => startEditing(u)}
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className="flex flex-col gap-2 mt-2">
                  {!isUninvited && (
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
                    </div>
                  )}
                  {!isUninvited && selectedRol?.nivel_acceso === "ADMIN_PROYECTO" && proyectos && proyectos.length > 0 && (
                    <ProyectosMultiSelect
                      proyectos={proyectos}
                      value={selectedProyectoIds}
                      onChange={setSelectedProyectoIds}
                    />
                  )}
                  <div className="flex items-center gap-2 justify-end">
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
          );
        })}
      </div>

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          proyectos={proyectos}
          canInviteAnyRole={canInviteAnyRole}
        />
      )}

      {showAddContratista && (
        <AddContratistaModal
          onClose={() => setShowAddContratista(false)}
        />
      )}
    </main>
  );
}
