"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Shield, ChevronDown } from "lucide-react";

type NivelAcceso = "DIRECTIVO" | "ADMINISTRADOR" | "CONTRATISTA" | "OBRERO";

interface Rol {
  id: string;
  nombre: string;
  nivel_acceso: NivelAcceso;
  es_default: boolean;
  _count: { usuarios: number };
}

const NIVELES: NivelAcceso[] = ["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"];

const NIVEL_LABELS: Record<NivelAcceso, string> = {
  DIRECTIVO: "Directivo",
  ADMINISTRADOR: "Administrador",
  CONTRATISTA: "Contratista",
  OBRERO: "Obrero",
};

const NIVEL_COLORS: Record<NivelAcceso, string> = {
  DIRECTIVO: "bg-violet-100 text-violet-700",
  ADMINISTRADOR: "bg-blue-100 text-blue-700",
  CONTRATISTA: "bg-amber-100 text-amber-700",
  OBRERO: "bg-emerald-100 text-emerald-700",
};

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

interface RolFormModalProps {
  initial?: Rol | null;
  onClose: () => void;
  onSaved: () => void;
}

function RolFormModal({ initial, onClose, onSaved }: RolFormModalProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [nivelAcceso, setNivelAcceso] = useState<NivelAcceso>(initial?.nivel_acceso ?? "OBRERO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const isEdit = !!initial;
    const url = isEdit ? `/api/roles/${initial!.id}` : "/api/roles";
    const method = isEdit ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), nivel_acceso: nivelAcceso }),
    });

    if (res.ok) {
      onSaved();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar el rol");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {initial ? "Editar rol" : "Agregar rol"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
          >
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
            <label className="text-sm font-medium text-slate-700">Nombre del rol</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Residente de obra"
                minLength={2}
                maxLength={50}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Nivel de acceso</label>
            <div className="relative">
              <select
                required
                value={nivelAcceso}
                onChange={(e) => setNivelAcceso(e.target.value as NivelAcceso)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 appearance-none bg-white cursor-pointer pr-10"
              >
                {NIVELES.map((n) => (
                  <option key={n} value={n}>{NIVEL_LABELS[n]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {loading ? "Guardando..." : initial ? "Guardar cambios" : "Crear rol"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ─────────────────────────────────────────────────

interface DeleteModalProps {
  rol: Rol;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteModal({ rol, onClose, onDeleted }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/roles/${rol.id}`, { method: "DELETE" });

    if (res.ok) {
      onDeleted();
      onClose();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al eliminar el rol");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Eliminar rol</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-5">
          ¿Seguro que deseas eliminar el rol{" "}
          <span className="font-semibold text-slate-900">{rol.nombre}</span>? Esta acción no se puede deshacer.
        </p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RolesManager() {
  const router = useRouter();
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRol, setEditingRol] = useState<Rol | null>(null);
  const [deletingRol, setDeletingRol] = useState<Rol | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Error al cargar roles");
      const data = await res.json();
      setRoles(Array.isArray(data) ? data : []);
    } catch {
      setFetchError("No se pudieron cargar los roles. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  function handleSaved() {
    fetchRoles();
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Gestión de roles</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Define los roles y niveles de acceso para tu constructora.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Agregar rol
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
          Cargando roles...
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-red-600">{fetchError}</p>
          <button
            onClick={fetchRoles}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : roles.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          No hay roles creados aún.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Nombre</th>
                <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Nivel de acceso</th>
                <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Usuarios</th>
                <th className="text-right text-xs font-semibold text-slate-500 pb-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((rol) => (
                <tr key={rol.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-slate-900">{rol.nombre}</span>
                    {rol.es_default && (
                      <span className="ml-2 text-xs text-slate-400 font-normal">(predeterminado)</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${NIVEL_COLORS[rol.nivel_acceso]}`}>
                      {NIVEL_LABELS[rol.nivel_acceso]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {rol._count.usuarios}
                  </td>
                  <td className="py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditingRol(rol)}
                        title="Editar rol"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => rol._count.usuarios === 0 && setDeletingRol(rol)}
                        disabled={rol._count.usuarios > 0}
                        title={
                          rol._count.usuarios > 0
                            ? "No se puede eliminar un rol con usuarios asignados"
                            : "Eliminar rol"
                        }
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <RolFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
        />
      )}
      {editingRol && (
        <RolFormModal
          initial={editingRol}
          onClose={() => setEditingRol(null)}
          onSaved={handleSaved}
        />
      )}
      {deletingRol && (
        <DeleteModal
          rol={deletingRol}
          onClose={() => setDeletingRol(null)}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}
