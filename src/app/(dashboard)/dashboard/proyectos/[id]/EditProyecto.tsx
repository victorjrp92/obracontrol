"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, History, Eye, EyeOff, Loader2, Trash2, AlertTriangle } from "lucide-react";

interface ProyectoData {
  id: string;
  nombre: string;
  dias_habiles_semana: number;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  estado: string;
}

interface AuditEntry {
  id: string;
  accion: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
  usuario: { nombre: string };
}

const CAMPO_LABELS: Record<string, string> = {
  nombre: "Nombre",
  dias_habiles_semana: "Dias habiles/semana",
  fecha_inicio: "Fecha inicio",
  fecha_fin_estimada: "Fecha fin estimada",
  estado: "Estado",
};

const ESTADO_OPTIONS = [
  { value: "ACTIVO", label: "Activo" },
  { value: "PAUSADO", label: "Pausado" },
  { value: "COMPLETADO", label: "Completado" },
  { value: "ARCHIVADO", label: "Archivado" },
];

function formatDateInput(d: string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

function formatDateDisplay(d: string | null): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export default function EditProyecto({ proyecto, canEdit = true }: { proyecto: ProyectoData; canEdit?: boolean }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Form state
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [diasHabiles, setDiasHabiles] = useState(proyecto.dias_habiles_semana);
  const [fechaInicio, setFechaInicio] = useState(formatDateInput(proyecto.fecha_inicio));
  const [fechaFin, setFechaFin] = useState(formatDateInput(proyecto.fecha_fin_estimada));
  const [estado, setEstado] = useState(proyecto.estado);

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete project
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"password" | "code">("password");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Audit log
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  function openDeleteModal() {
    setDeleteStep("password");
    setDeletePassword("");
    setShowDeletePassword(false);
    setDeleteCode("");
    setDeleteError("");
    setShowDeleteModal(true);
  }

  async function handleDeleteStep() {
    if (!deletePassword) {
      setDeleteError("Ingresa tu contraseña");
      return;
    }
    setDeleting(true);
    setDeleteError("");

    try {
      const body: Record<string, string> = { password: deletePassword };
      if (deleteStep === "code") body.codigo_verificacion = deleteCode;

      const res = await fetch(`/api/proyectos/${proyecto.id}/eliminar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error ?? "Error al procesar");
        return;
      }

      if (data.step === "codigo_enviado") {
        setDeleteStep("code");
        setDeleteError("");
        return;
      }

      if (data.deleted) {
        router.push("/dashboard/proyectos");
      }
    } catch {
      setDeleteError("Error de conexión");
    } finally {
      setDeleting(false);
    }
  }

  function buildCambios() {
    const cambios: Record<string, unknown> = {};
    if (nombre !== proyecto.nombre) cambios.nombre = nombre;
    if (diasHabiles !== proyecto.dias_habiles_semana) cambios.dias_habiles_semana = diasHabiles;
    const origInicio = formatDateInput(proyecto.fecha_inicio);
    if (fechaInicio !== origInicio) cambios.fecha_inicio = fechaInicio || null;
    const origFin = formatDateInput(proyecto.fecha_fin_estimada);
    if (fechaFin !== origFin) cambios.fecha_fin_estimada = fechaFin || null;
    if (estado !== proyecto.estado) cambios.estado = estado;
    return cambios;
  }

  function handleSaveClick() {
    const cambios = buildCambios();
    if (Object.keys(cambios).length === 0) {
      setError("No hay cambios para guardar");
      return;
    }
    setError("");
    setSuccess("");
    setPassword("");
    setShowPassword(false);
    setShowPasswordModal(true);
  }

  async function handleConfirmSave() {
    if (!password) {
      setError("Ingresa tu contrasena");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/editar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, cambios: buildCambios() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al guardar");
        setSaving(false);
        return;
      }
      setSuccess(`${data.cambios} campo(s) actualizado(s)`);
      setShowPasswordModal(false);
      setShowEdit(false);
      router.refresh();
    } catch {
      setError("Error de conexion");
    } finally {
      setSaving(false);
    }
  }

  async function loadAuditLog() {
    if (showLog) {
      setShowLog(false);
      return;
    }
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/editar`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingLogs(false);
      setShowLog(true);
    }
  }

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {canEdit && (
          <button
            onClick={() => { setShowEdit(!showEdit); setError(""); setSuccess(""); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {showEdit ? "Cancelar edicion" : "Editar proyecto"}
          </button>
        )}
        <button
          onClick={loadAuditLog}
          disabled={loadingLogs}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <History className="w-3.5 h-3.5" />
          {loadingLogs ? "Cargando..." : showLog ? "Ocultar historial" : "Historial de cambios"}
        </button>
        {canEdit && (
          <button
            onClick={openDeleteModal}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar proyecto
          </button>
        )}
      </div>

      {/* Success message */}
      {success && (
        <div className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 font-medium">
          {success}
        </div>
      )}

      {/* Edit form */}
      {showEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del proyecto</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dias habiles por semana</label>
              <input
                type="number"
                min={1}
                max={7}
                value={diasHabiles}
                onChange={(e) => setDiasHabiles(Number(e.target.value))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha fin estimada</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
              >
                {ESTADO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && !showPasswordModal && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <button
            onClick={handleSaveClick}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      )}

      {/* Password confirmation modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Confirmar cambios</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Ingresa tu contrasena de administrador para confirmar los cambios.</p>

            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmSave()}
                placeholder="Contrasena"
                autoFocus
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-600 mb-3">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete project modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900">Eliminar proyecto</h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteStep === "password" ? (
              <>
                <p className="text-sm text-slate-600 mb-1">
                  Vas a eliminar <strong>{proyecto.nombre}</strong>.
                </p>
                <p className="text-xs text-red-600 font-medium mb-4">
                  Esta acción es irreversible. Se eliminarán todas las unidades, tareas y datos asociados.
                </p>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña de administrador</label>
                <div className="relative mb-3">
                  <input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleDeleteStep()}
                    placeholder="Contraseña"
                    autoFocus
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  Se envió un código de verificación a tu correo. Ingrésalo para confirmar la eliminación.
                </p>
                <label className="block text-xs font-medium text-slate-600 mb-1">Código de verificación</label>
                <input
                  type="text"
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleDeleteStep()}
                  placeholder="Ej: A1B2C3"
                  autoFocus
                  maxLength={6}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 tracking-widest text-center font-mono text-lg mb-3"
                />
              </>
            )}

            {deleteError && (
              <p className="text-xs text-red-600 mb-3">{deleteError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStep}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting
                  ? deleteStep === "password" ? "Verificando..." : "Eliminando..."
                  : deleteStep === "password" ? "Enviar código" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit log */}
      {showLog && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-700">Historial de cambios</h3>
          </div>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No hay cambios registrados</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800">{log.usuario.nombre}</span>
                    <span className="text-slate-500"> cambio </span>
                    <span className="font-medium text-slate-700">{CAMPO_LABELS[log.campo] ?? log.campo}</span>
                    {log.valor_anterior && (
                      <>
                        <span className="text-slate-400"> de </span>
                        <span className="text-red-600 line-through">{log.campo.includes("fecha") ? formatDateDisplay(log.valor_anterior) : log.valor_anterior}</span>
                      </>
                    )}
                    <span className="text-slate-400"> a </span>
                    <span className="text-green-700 font-medium">{log.campo.includes("fecha") ? formatDateDisplay(log.valor_nuevo) : log.valor_nuevo}</span>
                  </div>
                  <span className="text-slate-400 whitespace-nowrap flex-shrink-0">
                    {new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(log.created_at))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
