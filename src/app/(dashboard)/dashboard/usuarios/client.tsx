"use client";

import { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import InviteUserModal from "@/components/dashboard/InviteUserModal";

interface UserRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rolLabel: string;
  created_at: string;
}

export default function UsuariosClient({ usuarios }: { usuarios: UserRow[] }) {
  const [showInvite, setShowInvite] = useState(false);

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
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Nombre</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Desde</span>
        </div>
        {usuarios.map((u) => (
          <div key={u.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {u.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-800">{u.nombre}</span>
            </div>
            <span className="text-sm text-slate-500 truncate">{u.email}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3" />
              {u.rolLabel}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
            </span>
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
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" />
                {u.rolLabel}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(u.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
    </main>
  );
}
