"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Users, ClipboardList, UserRound, Phone, Mail, RefreshCw, Eye, EyeOff, History, ShieldCheck, Search, CheckSquare, Square, AlertTriangle } from "lucide-react";

interface AsignarTareaItem {
  id: string;
  nombre: string;
  fase: string;
  subfase: string | null;
  espacio: string;
  unidad: string;
  edificio: string;
  estado: string;
  asignado_a: string | null;
  asignado_a_nombre: string | null;
}
interface AsignarContratistaItem {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface PermisosAdminProyecto {
  can_edit_project: boolean;
  can_assign_contractors: boolean;
  can_manage_team: boolean;
  can_approve_tasks: boolean;
}

interface AdminAsignado {
  usuario_id: string;
  nombre: string;
  email: string;
  rol: string;
  permisos: PermisosAdminProyecto;
}

const DEFAULT_PERMISOS: PermisosAdminProyecto = {
  can_edit_project: false,
  can_assign_contractors: false,
  can_manage_team: false,
  can_approve_tasks: true,
};

const PERMISOS_LABELS: { key: keyof PermisosAdminProyecto; label: string; descripcion: string }[] = [
  { key: "can_edit_project", label: "Editar proyecto", descripcion: "Modificar nombre, fechas y configuración del proyecto" },
  { key: "can_assign_contractors", label: "Asignar contratistas", descripcion: "Reasignar tareas entre contratistas" },
  { key: "can_manage_team", label: "Gestionar equipo", descripcion: "Agregar y quitar admins junior y personas externas" },
  { key: "can_approve_tasks", label: "Aprobar tareas", descripcion: "Aprobar o rechazar tareas reportadas" },
];
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

  // Permisos modal: si modo === "asignar", se hace POST (crea); si "editar", PATCH.
  const [permisosModal, setPermisosModal] = useState<
    | null
    | {
        modo: "asignar" | "editar";
        usuarioId: string;
        nombre: string;
        permisos: PermisosAdminProyecto;
      }
  >(null);
  const [permisosLoading, setPermisosLoading] = useState(false);
  const [permisosError, setPermisosError] = useState("");

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

  // Asignar tareas (bulk) state
  const [asignarTareasOpen, setAsignarTareasOpen] = useState(false);
  const [atLoading, setAtLoading] = useState(false);
  const [atSubmitting, setAtSubmitting] = useState(false);
  const [atError, setAtError] = useState("");
  const [atResult, setAtResult] = useState<string | null>(null);
  const [atBloqueadas, setAtBloqueadas] = useState<{ id: string; nombre: string; estado: string }[]>([]);
  const [atContratistas, setAtContratistas] = useState<AsignarContratistaItem[]>([]);
  const [atTareas, setAtTareas] = useState<AsignarTareaItem[]>([]);
  const [atContratistaId, setAtContratistaId] = useState("");
  const [atSelectedIds, setAtSelectedIds] = useState<Set<string>>(new Set());
  const [atFiltro, setAtFiltro] = useState("");
  const [atMotivo, setAtMotivo] = useState("");
  const [atPassword, setAtPassword] = useState("");
  const [atShowPw, setAtShowPw] = useState(false);

  async function openAsignarTareas() {
    setAsignarTareasOpen(true);
    setAtError("");
    setAtResult(null);
    setAtBloqueadas([]);
    setAtContratistaId("");
    setAtSelectedIds(new Set());
    setAtFiltro("");
    setAtMotivo("");
    setAtPassword("");
    setAtShowPw(false);
    setAtLoading(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/asignar-tareas`);
      if (res.ok) {
        const data = await res.json();
        setAtContratistas(data.contratistas ?? []);
        setAtTareas(data.tareas ?? []);
      } else {
        const d = await res.json().catch(() => ({}));
        setAtError(d.error ?? "Error cargando datos");
      }
    } catch {
      setAtError("Error cargando datos");
    } finally {
      setAtLoading(false);
    }
  }

  function closeAsignarTareas() {
    setAsignarTareasOpen(false);
  }

  function atToggle(id: string) {
    setAtSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function atFiltradas(): AsignarTareaItem[] {
    const q = atFiltro.trim().toLowerCase();
    if (!q) return atTareas;
    return atTareas.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        t.espacio.toLowerCase().includes(q) ||
        t.unidad.toLowerCase().includes(q) ||
        t.edificio.toLowerCase().includes(q),
    );
  }

  function atSeleccionarFiltradas() {
    const ids = atFiltradas().map((t) => t.id);
    setAtSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function atLimpiarSeleccion() {
    setAtSelectedIds(new Set());
  }

  async function handleAsignarTareas() {
    if (!atContratistaId || atSelectedIds.size === 0 || !atPassword) return;
    setAtError("");
    setAtBloqueadas([]);
    setAtSubmitting(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/asignar-tareas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contratista_id: atContratistaId,
          tarea_ids: Array.from(atSelectedIds),
          password: atPassword,
          motivo: atMotivo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAtResult(`${data.asignadas ?? atSelectedIds.size} tarea(s) asignadas`);
        setTimeout(() => {
          setAsignarTareasOpen(false);
          setAtResult(null);
          router.refresh();
        }, 2000);
      } else if (res.status === 409 && Array.isArray(data.bloqueadas)) {
        setAtBloqueadas(data.bloqueadas);
        setAtError(data.error ?? "Algunas tareas no se pueden asignar");
      } else {
        setAtError(data.error ?? "Error al asignar tareas");
      }
    } catch {
      setAtError("Error al asignar tareas");
    } finally {
      setAtSubmitting(false);
    }
  }

  function handleAsignar() {
    if (!asignar) return;
    setError("");
    const usuario = adminsDisponibles.find((a) => a.id === asignar);
    if (!usuario) return;
    setPermisosModal({
      modo: "asignar",
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      permisos: { ...DEFAULT_PERMISOS },
    });
  }

  function handleEditarPermisos(admin: AdminAsignado) {
    setPermisosError("");
    setPermisosModal({
      modo: "editar",
      usuarioId: admin.usuario_id,
      nombre: admin.nombre,
      permisos: { ...admin.permisos },
    });
  }

  async function handleGuardarPermisos() {
    if (!permisosModal) return;
    setPermisosError("");
    setPermisosLoading(true);
    try {
      const isAsignar = permisosModal.modo === "asignar";
      const res = await fetch(`/api/proyectos/${proyectoId}/admins`, {
        method: isAsignar ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: permisosModal.usuarioId,
          permisos: permisosModal.permisos,
        }),
      });
      if (res.ok) {
        setPermisosModal(null);
        if (isAsignar) setAsignar("");
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setPermisosError(d.error ?? "Error al guardar permisos");
      }
    } finally {
      setPermisosLoading(false);
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
            {adminsAsignados.map((a) => {
              const perms = a.permisos;
              const permsActivos = PERMISOS_LABELS.filter((p) => perms[p.key]).length;
              return (
                <div key={a.usuario_id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-800 truncate">{a.nombre}</div>
                    <div className="text-xs text-slate-500 truncate">{a.email} · {a.rol}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {permsActivos === 0
                        ? "Sin permisos extra"
                        : `${permsActivos} de ${PERMISOS_LABELS.length} permisos`}
                    </div>
                  </div>
                  {canAssign && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEditarPermisos(a)}
                        className="text-blue-600 hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 inline-flex items-center gap-1 text-xs font-semibold"
                        title="Editar permisos"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Permisos</span>
                      </button>
                      <button
                        onClick={() => handleQuitar(a.usuario_id, a.nombre)}
                        className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                        title="Quitar del proyecto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Contratistas */}
      <Section
        title={`Contratistas (${contratistas.length})`}
        icon={ClipboardList}
        action={
          canAssign ? (
            <button
              onClick={openAsignarTareas}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Asignar tareas
            </button>
          ) : null
        }
      >
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

      {/* Modal permisos Admin Junior */}
      {permisosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h4 className="font-bold text-slate-800 mb-1">
              {permisosModal.modo === "asignar" ? "Asignar Admin Junior" : "Editar permisos"}
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-medium">{permisosModal.nombre}</span> — define qué puede hacer en este proyecto.
            </p>

            {permisosError && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {permisosError}
              </div>
            )}

            <div className="flex flex-col gap-2 mb-5">
              {PERMISOS_LABELS.map((p) => (
                <label
                  key={p.key}
                  className="flex items-start gap-3 p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-1 w-4 h-4 accent-blue-600"
                    checked={permisosModal.permisos[p.key]}
                    onChange={(e) =>
                      setPermisosModal((m) =>
                        m ? { ...m, permisos: { ...m.permisos, [p.key]: e.target.checked } } : m,
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.descripcion}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPermisosModal(null)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarPermisos}
                disabled={permisosLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                {permisosLoading
                  ? "Guardando..."
                  : permisosModal.modo === "asignar"
                  ? "Asignar"
                  : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Asignar tareas (bulk) modal */}
      {asignarTareasOpen && (
        <AsignarTareasModal
          loading={atLoading}
          submitting={atSubmitting}
          error={atError}
          result={atResult}
          bloqueadas={atBloqueadas}
          contratistas={atContratistas}
          tareas={atTareas}
          tareasFiltradas={atFiltradas()}
          filtro={atFiltro}
          setFiltro={setAtFiltro}
          contratistaId={atContratistaId}
          setContratistaId={setAtContratistaId}
          selectedIds={atSelectedIds}
          toggle={atToggle}
          seleccionarFiltradas={atSeleccionarFiltradas}
          limpiarSeleccion={atLimpiarSeleccion}
          motivo={atMotivo}
          setMotivo={setAtMotivo}
          password={atPassword}
          setPassword={setAtPassword}
          showPw={atShowPw}
          setShowPw={setAtShowPw}
          onCancel={closeAsignarTareas}
          onSubmit={handleAsignarTareas}
        />
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
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-800 truncate">{title}</h3>
        </div>
        {action ? <div className="flex-shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 text-center py-4">{children}</p>;
}

function AsignarTareasModal({
  loading,
  submitting,
  error,
  result,
  bloqueadas,
  contratistas,
  tareas,
  tareasFiltradas,
  filtro,
  setFiltro,
  contratistaId,
  setContratistaId,
  selectedIds,
  toggle,
  seleccionarFiltradas,
  limpiarSeleccion,
  motivo,
  setMotivo,
  password,
  setPassword,
  showPw,
  setShowPw,
  onCancel,
  onSubmit,
}: {
  loading: boolean;
  submitting: boolean;
  error: string;
  result: string | null;
  bloqueadas: { id: string; nombre: string; estado: string }[];
  contratistas: AsignarContratistaItem[];
  tareas: AsignarTareaItem[];
  tareasFiltradas: AsignarTareaItem[];
  filtro: string;
  setFiltro: (v: string) => void;
  contratistaId: string;
  setContratistaId: (v: string) => void;
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  seleccionarFiltradas: () => void;
  limpiarSeleccion: () => void;
  motivo: string;
  setMotivo: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPw: boolean;
  setShowPw: (v: boolean) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  // Group filtered tareas by edificio
  const grupos = new Map<string, AsignarTareaItem[]>();
  for (const t of tareasFiltradas) {
    const key = t.edificio;
    const arr = grupos.get(key) ?? [];
    arr.push(t);
    grupos.set(key, arr);
  }

  const disabled = !contratistaId || selectedIds.size === 0 || !password || submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <h4 className="font-bold text-slate-800 mb-1">Asignar tareas a contratista</h4>
        <p className="text-sm text-slate-600 mb-4">
          Solo se pueden asignar tareas <span className="font-medium">pendientes</span> o{" "}
          <span className="font-medium">rechazadas</span>.
        </p>

        {result ? (
          <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 mb-3">
            {result}
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div>{error}</div>
                    {bloqueadas.length > 0 && (
                      <ul className="mt-2 text-xs list-disc pl-4 max-h-24 overflow-y-auto">
                        {bloqueadas.map((b) => (
                          <li key={b.id}>
                            <span className="font-medium">{b.nombre}</span>{" "}
                            <span className="text-red-500">({b.estado})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">Cargando datos...</div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Contratista destino: <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={contratistaId}
                    onChange={(e) => setContratistaId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  >
                    <option value="">Seleccionar contratista...</option>
                    {contratistas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Tareas: <span className="text-slate-500 font-normal">{selectedIds.size} seleccionadas / {tareas.length} disponibles</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={seleccionarFiltradas}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        <CheckSquare className="w-3 h-3" /> Seleccionar filtradas
                      </button>
                      <button
                        type="button"
                        onClick={limpiarSeleccion}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100"
                      >
                        <Square className="w-3 h-3" /> Limpiar
                      </button>
                    </div>
                  </div>

                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      placeholder="Filtrar por nombre, espacio, unidad o edificio..."
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                    />
                  </div>

                  <div className="border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                    {tareasFiltradas.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">
                        {tareas.length === 0 ? "No hay tareas asignables." : "Ninguna tarea coincide con el filtro."}
                      </div>
                    ) : (
                      Array.from(grupos.entries()).map(([edificio, items]) => (
                        <div key={edificio}>
                          <div className="px-3 py-1 bg-slate-50 text-[11px] font-semibold text-slate-600 sticky top-0">
                            {edificio}
                          </div>
                          {items.map((t) => {
                            const checked = selectedIds.has(t.id);
                            return (
                              <label
                                key={t.id}
                                className="flex items-start gap-2 px-3 py-2 border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggle(t.id)}
                                  className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-slate-800 truncate">
                                    {t.nombre}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {t.espacio} · {t.unidad}
                                    {t.subfase ? ` · ${t.fase}/${t.subfase}` : ` · ${t.fase}`}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {t.asignado_a_nombre ? (
                                      <>Actual: <span className="font-medium">{t.asignado_a_nombre}</span></>
                                    ) : (
                                      <span className="italic">Sin asignar</span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Motivo (opcional):</label>
                  <input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: nueva fase de obra, refuerzo de equipo..."
                    maxLength={500}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Contraseña: <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Confirma tu contraseña"
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm bg-white"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !disabled) onSubmit();
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={onCancel}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={onSubmit}
                disabled={disabled}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {submitting ? "Asignando..." : `Asignar (${selectedIds.size})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
