"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Save, X, Building2, Shield } from "lucide-react";

const VALID_NIVELES = ["DIRECTIVO", "ADMIN_GENERAL", "ADMIN_PROYECTO", "CONTRATISTA", "OBRERO"] as const;

interface Rol {
  id: string;
  nombre: string;
  nivel_acceso: string;
  es_default: boolean;
  usuarios: number;
}

interface Grupo {
  constructora_id: string;
  constructora_nombre: string;
  roles: Rol[];
}

const NIVEL_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
  DIRECTIVO: "bg-purple-100 text-purple-700 border-purple-200",
  ADMIN_GENERAL: "bg-orange-100 text-orange-700 border-orange-200",
  ADMIN_PROYECTO: "bg-yellow-100 text-yellow-700 border-yellow-200",
  CONTRATISTA: "bg-green-100 text-green-700 border-green-200",
  OBRERO: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function RolesClient({ grupos }: { grupos: Grupo[] }) {
  return (
    <div className="flex flex-col gap-4">
      {grupos.map((g) => (
        <div key={g.constructora_id} className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-slate-500" />
            <Link
              href={`/super-admin/constructoras/${g.constructora_id}`}
              className="font-bold text-slate-800 hover:text-red-600"
            >
              {g.constructora_nombre}
            </Link>
            <span className="text-xs text-slate-400">· {g.roles.length} roles</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2 font-medium">Rol</th>
                  <th className="py-2 font-medium">Nivel acceso</th>
                  <th className="py-2 font-medium">Usuarios</th>
                  <th className="py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {g.roles.map((r) => (
                  <RolRow key={r.id} rol={r} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function RolRow({ rol }: { rol: Rol }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(rol.nombre);
  const [nivel, setNivel] = useState(rol.nivel_acceso);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = rol.nivel_acceso === "SUPER_ADMIN";

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/super-admin/roles/${rol.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, nivel_acceso: nivel }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  async function remove() {
    if (!confirm(`¿Eliminar rol "${rol.nombre}"?`)) return;
    const res = await fetch(`/api/super-admin/roles/${rol.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar");
    }
  }

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2.5">
        {editing && !isSuperAdmin ? (
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="px-2 py-1 rounded border border-slate-200 text-sm w-full"
          />
        ) : (
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-800">{rol.nombre}</span>
            {rol.es_default && (
              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">default</span>
            )}
          </div>
        )}
      </td>
      <td className="py-2.5">
        {editing && !isSuperAdmin ? (
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className="px-2 py-1 rounded border border-slate-200 text-sm"
          >
            {VALID_NIVELES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : (
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border ${NIVEL_COLOR[rol.nivel_acceso] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
            {rol.nivel_acceso}
          </span>
        )}
      </td>
      <td className="py-2.5 text-slate-700 font-semibold">{rol.usuarios}</td>
      <td className="py-2.5">
        <div className="flex items-center gap-1 justify-end">
          {isSuperAdmin ? (
            <span className="text-xs text-slate-400">protegido</span>
          ) : editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setNombre(rol.nombre); setNivel(rol.nivel_acceso); }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-50"
                title="Guardar"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded hover:bg-blue-50 text-blue-600"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={remove}
                disabled={rol.usuarios > 0}
                className="p-1.5 rounded hover:bg-red-50 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title={rol.usuarios > 0 ? "No se puede eliminar: tiene usuarios" : "Eliminar"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
