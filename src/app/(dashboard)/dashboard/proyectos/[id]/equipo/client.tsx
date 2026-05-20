"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Users, ClipboardList, UserRound, Phone, Mail, RefreshCw, Eye, EyeOff, History } from "lucide-react";

interface AdminAsignado {
  usuario_id: string;
  nombre: string;
  email: string;
  rol: string;
}
interface AdminDisponible {
  id: string;
  nombre: string;
  email: string;
}
interface ContratistaRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  tareas: number;
  obreros: number;
}
interface PersonaExterna {
  id: string;
  nombre: string;
  cargo: string | null;
  telefono: string | null;
  email: string | null;
}

interface Props {
  proyectoId: string;
  canAssign: boolean;
  adminsAsignados: AdminAsignado[];
  adminsDisponibles: AdminDisponible[];
  contratistas: ContratistaRow[];
  personasExternas: PersonaExterna[];
}

export default function EquipoAdminGeneral({
  proyectoId,
  canAssign,
  adminsAsignados,
  adminsDisponibles,
  contratistas,
  personasExternas,
}: Props) {
  const router = useRouter();
  const [asignar, setAsignar] = useState("");
  const [error, setError] = useState("");

  // Personas externas state
  const [personaForm, setPersonaForm] = useState({ nombre: "", cargo: "", telefono: "", email: "" });
  const [personaError, setPersonaError] = useState("");
  const [personaLoading, setPersonaLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Reasignación state
  const [reasignarId, setReasignarId] = useState<string | null>(null);
  const [reasignarNuevoId, setReasignarNuevoId] = useState("");
  const [reasignarMotivo, setReasignarMotivo] = useState("");
  const [reasignarPassword, setReasignarPassword] = useState("");
  const [reasignarShowPw, setReasignarShowPw] = useState(false);
  const [reasignarError, setReasignarError] = useState("");
  const [reasignarLoading, setReasignarLoading] = useState(false);
  const [reasignarResult, setReasignarResult] = useState<string | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial, setHistorial] = useState<{ id: string; contratista_anterior: { nombre: string } | null; contratista_nuevo: { nombre: string } | null; realizado: { nombre: string }; motivo: string | null; created_at: string }[]>([]);

  async function handleAsignar() {
    if (!asignar) return;
    setError("");
    const res = await fetch(`/api/proyectos/${proyectoId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: asignar }),
    });
    if (res.ok) {
      setAsignar("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Error al asignar");
    }
  }

  async function handleQuitar(usuario_id: string, nombre: string) {
    if (!confirm(`¿Quitar a ${nombre} de este proyecto?`)) return;
    const res = await fetch(`/api/proyectos/${proyectoId}/admins?usuario_id=${usuario_id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al quitar");
    }
  }

  async function handleAddPersona() {
    if (!personaForm.nombre.trim()) return;
    setPersonaError("");
    setPersonaLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/personas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: personaForm.nombre.trim(),
          cargo: personaForm.cargo.trim() || undefined,
          telefono: personaForm.telefono.trim() || undefined,
          email: personaForm.email.trim() || undefined,
        }),
      });
      if (res.ok) {
        setPersonaForm({ nombre: "", cargo: "", telefono: "", email: "" });
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setPersonaError(d.error ?? "Error al agregar persona");
      }
    } finally {
      setPersonaLoading(false);
    }
  }

  async function handleReasignar() {
    if (!reasignarId || !reasignarPassword) return;
    setReasignarError("");
    setReasignarLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reasignar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratista_anterior_id: reasignarId,
          contratista_nuevo_id: reasignarNuevoId || null,
          password: reasignarPassword,
          motivo: reasignarMotivo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReasignarResult(data.mensaje);
        setTimeout(() => {
          setReasignarId(null);
          setReasignarResult(null);
          router.refresh();
        }, 2000);
      } else {
        setReasignarError(data.error ?? "Error al reasignar");
      }
    } finally {
      setReasignarLoading(false);
    }
  }

  function openReasignar(cId: string) {
    setReasignarId(cId);
    setReasignarNuevoId("");
    setReasignarMotivo("");
    setReasignarPassword("");
    setReasignarShowPw(false);
    setReasignarError("");
    setReasignarResult(null);
  }

  async function loadHistorial() {
    setShowHistorial(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/reasignar`);
      if (res.ok) setHistorial(await res.json());
    } catch { /* ignore */ }
  }

  async function handleDeletePersona() {
    if (!deleteId || !deletePassword) return;
    setDeleteError("");
    const res = await fetch(`/api/proyectos/${proyectoId}/personas`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteId, password: deletePassword }),
    });
    if (res.ok) {
      setDeleteId(null);
      setDeletePassword("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setDeleteError(d.error ?? "Error al eliminar");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Admin Juniors -- first col */}
      <Section title={`Admin Juniors asignados (${adminsAsignados.length})`} icon={Users}>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {canAssign && (
          <div className="flex gap-2 mb-3">
            <select
              value={asignar}
              onChange={(e) => setAsignar(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">+ Asignar Admin Junior...</option>
              {adminsDisponibles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} — {a.email}
                </option>
              ))}
            </select>
            <button
              onClick={handleAsignar}
              disabled={!asignar}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" /> Asignar
            </button>
          </div>
        )}

        {adminsAsignados.length === 0 ? (
          <Empty>Sin Admin Juniors asignados.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {adminsAsignados.map((a) => (
              <div key={a.usuario_id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{a.nombre}</div>
                  <div className="text-xs text-slate-500 truncate">{a.email} · {a.rol}</div>
                </div>
                {canAssign && (
                  <button
                    onClick={() => handleQuitar(a.usuario_id, a.nombre)}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 flex-shrink-0"
                    title="Quitar del proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Contratistas */}
      <Section title={`Contratistas (${contratistas.length})`} icon={ClipboardList}>
        {contratistas.length === 0 ? (
          <Empty>Sin contratistas con tareas en este proyecto.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {contratistas.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{c.nombre}</div>
                  <div className="text-xs text-slate-500 truncate">{c.email} · {c.rol}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] flex-shrink-0">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {c.tareas} tareas
                  </span>
                  <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-semibold">
                    {c.obreros} obreros
                  </span>
                  {canAssign && c.tareas > 0 && (
                    <button
                      onClick={() => openReasignar(c.id)}
                      className="ml-1 text-violet-600 hover:text-violet-800 p-1 rounded hover:bg-violet-50"
                      title="Reasignar tareas"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canAssign && contratistas.length > 0 && (
          <button
            onClick={loadHistorial}
            className="mt-3 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            Historial de reasignaciones
          </button>
        )}

        {showHistorial && (
          <div className="mt-3 border border-slate-100 rounded-lg max-h-48 overflow-y-auto">
            {historial.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Sin reasignaciones</div>
            ) : historial.map(h => (
              <div key={h.id} className="px-3 py-2 border-b border-slate-50 last:border-b-0 text-[11px] text-slate-600">
                <span className="font-medium">{h.contratista_anterior?.nombre ?? "Sin asignar"}</span>
                {" → "}
                <span className="font-medium">{h.contratista_nuevo?.nombre ?? "Sin asignar"}</span>
                <span className="text-slate-400 ml-2">por {h.realizado.nombre}</span>
                {h.motivo && <span className="text-slate-400 ml-1">— {h.motivo}</span>}
                <span className="text-slate-300 ml-2">{new Date(h.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Reasignación modal */}
      {reasignarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h4 className="font-bold text-slate-800 mb-1">Reasignar tareas</h4>
            <p className="text-sm text-slate-600 mb-4">
              Solo se reasignan tareas <span className="font-medium">pendientes</span> y{" "}
              <span className="font-medium">rechazadas</span>. Las tareas aprobadas conservan su contratista original.
            </p>

            {reasignarResult ? (
              <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 mb-3">
                {reasignarResult}
              </div>
            ) : (
              <>
                {reasignarError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {reasignarError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Reasignar a:</label>
                    <select
                      value={reasignarNuevoId}
                      onChange={e => setReasignarNuevoId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                    >
                      <option value="">Sin asignar (quitar contratista)</option>
                      {contratistas.filter(c => c.id !== reasignarId).map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Motivo (opcional):</label>
                    <input
                      value={reasignarMotivo}
                      onChange={e => setReasignarMotivo(e.target.value)}
                      placeholder="Ej: Renunció, cambio de personal..."
                      maxLength={500}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Contraseña:</label>
                    <div className="relative">
                      <input
                        type={reasignarShowPw ? "text" : "password"}
                        value={reasignarPassword}
                        onChange={e => setReasignarPassword(e.target.value)}
                        placeholder="Confirma tu contraseña"
                        className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm bg-white"
                        onKeyDown={e => { if (e.key === "Enter") handleReasignar(); }}
                      />
                      <button
                        type="button"
                        onClick={() => setReasignarShowPw(!reasignarShowPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {reasignarShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end mt-4">
                  <button
                    onClick={() => setReasignarId(null)}
                    className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReasignar}
                    disabled={!reasignarPassword || reasignarLoading}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reasignarLoading ? "animate-spin" : ""}`} />
                    {reasignarLoading ? "Reasignando..." : "Reasignar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Personas externas -- spans both columns */}
      <div className="lg:col-span-2">
      <Section title={`Personas externas (${personasExternas.length})`} icon={UserRound}>
        {personaError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{personaError}</div>
        )}

        {canAssign && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre *"
                value={personaForm.nombre}
                onChange={(e) => setPersonaForm((f) => ({ ...f, nombre: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              />
              <input
                type="text"
                placeholder="Cargo"
                value={personaForm.cargo}
                onChange={(e) => setPersonaForm((f) => ({ ...f, cargo: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              />
              <input
                type="tel"
                placeholder="Telefono"
                value={personaForm.telefono}
                onChange={(e) => setPersonaForm((f) => ({ ...f, telefono: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              />
              <input
                type="email"
                placeholder="Email"
                value={personaForm.email}
                onChange={(e) => setPersonaForm((f) => ({ ...f, email: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
              />
            </div>
            <button
              onClick={handleAddPersona}
              disabled={!personaForm.nombre.trim() || personaLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" /> {personaLoading ? "Agregando..." : "Agregar persona"}
            </button>
          </div>
        )}

        {personasExternas.length === 0 ? (
          <Empty>Sin personas externas vinculadas.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {personasExternas.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{p.nombre}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {p.cargo && <span>{p.cargo}</span>}
                    {p.telefono && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {p.telefono}
                      </span>
                    )}
                    {p.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {p.email}
                      </span>
                    )}
                  </div>
                </div>
                {canAssign && (
                  <button
                    onClick={() => { setDeleteId(p.id); setDeletePassword(""); setDeleteError(""); }}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 flex-shrink-0"
                    title="Eliminar persona"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
              <h4 className="font-bold text-slate-800 mb-2">Confirmar eliminacion</h4>
              <p className="text-sm text-slate-600 mb-4">
                Ingresa tu contrasena para confirmar la eliminacion de esta persona.
              </p>
              {deleteError && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{deleteError}</div>
              )}
              <input
                type="password"
                placeholder="Contrasena"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white mb-3"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleDeletePersona(); }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setDeleteId(null); setDeletePassword(""); setDeleteError(""); }}
                  className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePersona}
                  disabled={!deletePassword}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
        <Icon className="w-4 h-4 text-slate-500" />
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 text-center py-4">{children}</p>;
}
