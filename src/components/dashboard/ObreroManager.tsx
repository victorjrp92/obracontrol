"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Check,
  Loader2,
  UserPlus,
  X,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Trash2,
  Users,
} from "lucide-react";

interface Obrero {
  id: string;
  nombre: string;
  token: string;
  activo: boolean;
  fecha_inicio: string;
  fecha_expiracion: string;
  created_at: string;
  _count?: { evidencias: number };
}

function getEstado(obrero: Obrero): "activo" | "expirado" | "desactivado" {
  if (!obrero.activo) return "desactivado";
  const now = new Date();
  if (now > new Date(obrero.fecha_expiracion)) return "expirado";
  return "activo";
}

function EstadoBadge({ estado }: { estado: "activo" | "expirado" | "desactivado" }) {
  const styles = {
    activo: "bg-green-50 text-green-700 border-green-200",
    expirado: "bg-amber-50 text-amber-700 border-amber-200",
    desactivado: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const labels = {
    activo: "Activo",
    expirado: "Expirado",
    desactivado: "Desactivado",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[estado]}`}
    >
      {labels[estado]}
    </span>
  );
}

export default function ObreroManager() {
  const [obreros, setObreros] = useState<Obrero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createInicio, setCreateInicio] = useState("");
  const [createExpiracion, setCreateExpiracion] = useState("");
  const [creating, setCreating] = useState(false);

  // Link modal (after creation)
  const [showLink, setShowLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Extend modal
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extending, setExtending] = useState(false);

  // Copy token feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchObreros();
  }, []);

  async function fetchObreros() {
    setLoading(true);
    try {
      const res = await fetch("/api/obreros");
      if (!res.ok) throw new Error("Error cargando obreros");
      const data = await res.json();
      setObreros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!createName.trim() || !createInicio || !createExpiracion) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/obreros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: createName.trim(),
          fecha_inicio: createInicio,
          fecha_expiracion: createExpiracion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error creando obrero");

      setShowCreate(false);
      setCreateName("");
      setCreateInicio("");
      setCreateExpiracion("");
      setGeneratedLink(data.url);
      setShowLink(true);
      setLinkCopied(false);
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(obrero: Obrero) {
    try {
      const res = await fetch(`/api/obreros/${obrero.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !obrero.activo }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error");
      }
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleExtend() {
    if (!extendId || !extendDate) return;
    setExtending(true);
    try {
      const res = await fetch(`/api/obreros/${extendId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_expiracion: extendDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error");
      }
      setExtendId(null);
      setExtendDate("");
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setExtending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Estas seguro de eliminar este obrero?")) return;
    try {
      const res = await fetch(`/api/obreros/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error");
      }
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function copyLink(token: string) {
    const siteUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://seiricon.com";
    const url = `${siteUrl}/o/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          <span className="text-sm text-slate-500">
            {obreros.length} obrero{obreros.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Agregar obrero
        </button>
      </div>

      {/* Obreros list */}
      {obreros.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            No tienes obreros registrados. Agrega uno para darle acceso a tus
            tareas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex flex-col divide-y divide-slate-50">
            {obreros.map((o) => {
              const estado = getEstado(o);
              return (
                <div
                  key={o.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 truncate">
                        {o.nombre}
                      </span>
                      <EstadoBadge estado={estado} />
                    </div>
                    <p className="text-xs text-slate-500">
                      Expira:{" "}
                      {new Date(o.fecha_expiracion).toLocaleDateString(
                        "es-CO",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Copy link */}
                    <button
                      onClick={() => copyLink(o.token)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Copiar enlace"
                    >
                      {copiedId === o.token ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Enlace
                        </>
                      )}
                    </button>

                    {/* Extend */}
                    <button
                      onClick={() => {
                        setExtendId(o.id);
                        setExtendDate(
                          new Date(o.fecha_expiracion)
                            .toISOString()
                            .split("T")[0]
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Extender fecha"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Extender
                    </button>

                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggleActive(o)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title={o.activo ? "Desactivar" : "Reactivar"}
                    >
                      {o.activo ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-green-600" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />
                          Reactivar
                        </>
                      )}
                    </button>

                    {/* Delete (only if no evidencias) */}
                    {o._count && o._count.evidencias === 0 && (
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                Agregar obrero
              </h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">
                  Nombre del obrero
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ej: Juan Perez"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={createInicio}
                  onChange={(e) => setCreateInicio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1 block">
                  Fecha de expiracion
                </label>
                <input
                  type="date"
                  value={createExpiracion}
                  onChange={(e) => setCreateExpiracion(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={
                  creating ||
                  !createName.trim() ||
                  !createInicio ||
                  !createExpiracion
                }
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {creating ? "Creando..." : "Crear obrero"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal (after creation) */}
      {showLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Obrero creado
              </h3>
              <button
                onClick={() => setShowLink(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Comparte este enlace con el obrero para que pueda acceder a sus
              tareas:
            </p>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 break-all text-sm text-slate-700 font-mono">
              {generatedLink}
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
            >
              {linkCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar enlace
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Extender acceso
              </h3>
              <button
                onClick={() => {
                  setExtendId(null);
                  setExtendDate("");
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-700 mb-1 block">
                Nueva fecha de expiracion
              </label>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            <button
              onClick={handleExtend}
              disabled={extending || !extendDate}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
            >
              {extending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              {extending ? "Actualizando..." : "Actualizar fecha"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
