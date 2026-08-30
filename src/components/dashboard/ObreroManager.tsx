"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Copy, Check, Loader2, UserPlus, X, ToggleLeft, ToggleRight,
  Calendar, Trash2, Users, Star, Award, Pencil, MapPin, ShieldAlert,
} from "lucide-react";
import { ESPECIALIDADES, ESPECIALIDAD_LABEL, TIPOS_SANGRE } from "@/lib/obrero";

interface Obrero {
  id: string;
  nombre: string;
  token: string;
  activo: boolean;
  fecha_inicio: string;
  fecha_expiracion: string;
  created_at: string;
  cedula?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  eps?: string | null;
  arl?: string | null;
  anos_experiencia?: number | null;
  // Opcionales: GET /api/obreros (la lista) SÍ los trae — la ficha los pinta
  // sin abrir «Editar». `openEdit()` los reconcilia igualmente con la ficha
  // completa de GET /api/obreros/[id], que es la fuente de verdad.
  fecha_nacimiento?: string | null;
  direccion?: string | null;
  contacto_emergencia?: string | null;
  contacto_emergencia_telefono?: string | null;
  tipo_sangre?: string | null;
  score_total?: number;
  score_calidad?: number;
  evidencias_aprobadas?: number;
  evidencias_rechazadas?: number;
  tareas_completadas?: number;
  _count?: { evidencias: number };
}

interface FormState {
  nombre: string;
  cedula: string;
  telefono: string;
  especialidad: string;
  eps: string;
  arl: string;
  fecha_inicio: string;
  fecha_expiracion: string;
  // Opcionales
  fecha_nacimiento: string;
  direccion: string;
  contacto_emergencia: string;
  contacto_emergencia_telefono: string;
  tipo_sangre: string;
  anos_experiencia: string;
}

const EMPTY_FORM: FormState = {
  nombre: "",
  cedula: "",
  telefono: "",
  especialidad: "",
  eps: "",
  arl: "",
  fecha_inicio: "",
  fecha_expiracion: "",
  fecha_nacimiento: "",
  direccion: "",
  contacto_emergencia: "",
  contacto_emergencia_telefono: "",
  tipo_sangre: "",
  anos_experiencia: "",
};

function getEstado(o: Obrero): "activo" | "expirado" | "desactivado" {
  if (!o.activo) return "desactivado";
  if (new Date() > new Date(o.fecha_expiracion)) return "expirado";
  return "activo";
}

function EstadoBadge({ estado }: { estado: "activo" | "expirado" | "desactivado" }) {
  const styles = {
    activo: "bg-green-50 text-green-700 border-green-200",
    expirado: "bg-amber-50 text-amber-700 border-amber-200",
    desactivado: "bg-slate-50 text-slate-500 border-slate-200",
  };
  const labels = { activo: "Activo", expirado: "Expirado", desactivado: "Desactivado" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[estado]}`}>
      {labels[estado]}
    </span>
  );
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null || score === 0) {
    return <span className="text-[10px] text-slate-400">Sin calificar</span>;
  }
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${color}`}>
      <Star className="w-3 h-3 fill-current" /> {score}
    </span>
  );
}

export default function ObreroManager() {
  const [obreros, setObreros] = useState<Obrero[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal create / edit
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modal link después de crear
  const [showLink, setShowLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Extender
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [extending, setExtending] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Id del registro cuya ficha completa se está pidiendo en openEdit(), para
  // descartar la respuesta si mientras tanto se cerró el modal o se abrió
  // otro registro (evita pisar el formulario con datos de un edit anterior).
  const editingRequestId = useRef<string | null>(null);

  useEffect(() => { fetchObreros(); }, []);

  async function fetchObreros() {
    setLoading(true);
    try {
      const res = await fetch("/api/obreros");
      if (!res.ok) throw new Error("Error cargando personal de campo");
      setObreros(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    editingRequestId.current = null;
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  async function openEdit(o: Obrero) {
    editingRequestId.current = o.id;
    setEditingId(o.id);
    setForm({
      nombre: o.nombre,
      cedula: o.cedula ?? "",
      telefono: o.telefono ?? "",
      especialidad: o.especialidad ?? "",
      eps: o.eps ?? "",
      arl: o.arl ?? "",
      fecha_inicio: o.fecha_inicio.slice(0, 10),
      fecha_expiracion: o.fecha_expiracion.slice(0, 10),
      fecha_nacimiento: o.fecha_nacimiento ? String(o.fecha_nacimiento).slice(0, 10) : "",
      direccion: o.direccion ?? "",
      contacto_emergencia: o.contacto_emergencia ?? "",
      contacto_emergencia_telefono: o.contacto_emergencia_telefono ?? "",
      tipo_sangre: o.tipo_sangre ?? "",
      anos_experiencia: o.anos_experiencia != null ? String(o.anos_experiencia) : "",
    });
    setError("");
    setShowForm(true);

    // El formulario ya quedó prellenado con lo que trae la lista; esta llamada
    // reconcilia con la ficha completa por si la lista se cargó antes de un
    // cambio hecho en otra pestaña.
    try {
      const res = await fetch(`/api/obreros/${o.id}`);
      if (editingRequestId.current !== o.id) return; // se cerró o se abrió otro edit mientras cargaba
      if (!res.ok) return;
      const full = await res.json();
      if (editingRequestId.current !== o.id) return;
      setForm((prev) => ({
        ...prev,
        fecha_nacimiento: full.fecha_nacimiento ? String(full.fecha_nacimiento).slice(0, 10) : "",
        direccion: full.direccion ?? "",
        contacto_emergencia: full.contacto_emergencia ?? "",
        contacto_emergencia_telefono: full.contacto_emergencia_telefono ?? "",
        tipo_sangre: full.tipo_sangre ?? "",
      }));
    } catch {
      // Si falla, esos campos quedan como estaban (vacíos o de la lista) y el
      // usuario puede reescribirlos sin perder el resto del formulario.
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        anos_experiencia: form.anos_experiencia === "" ? null : Number(form.anos_experiencia),
      };
      const res = await fetch(editingId ? `/api/obreros/${editingId}` : "/api/obreros", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");

      setShowForm(false);
      setForm(EMPTY_FORM);
      if (!editingId && data.url) {
        setGeneratedLink(data.url);
        setShowLink(true);
        setLinkCopied(false);
      }
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(o: Obrero) {
    try {
      const res = await fetch(`/api/obreros/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !o.activo }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error");
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
        const d = await res.json();
        throw new Error(d.error ?? "Error");
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
    if (!confirm("¿Eliminar a esta persona de campo?")) return;
    try {
      const res = await fetch(`/api/obreros/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error");
      }
      await fetchObreros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  function copyLink(token: string) {
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://seiricon.com";
    navigator.clipboard.writeText(`${siteUrl}/o/${token}`);
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
          <button onClick={() => setError("")} className="ml-2 text-red-500 hover:text-red-700">
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-500" />
          <span className="text-sm text-slate-500">
            {obreros.length} {obreros.length === 1 ? "persona de campo" : "personas de campo"}
          </span>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Agregar personal de campo
        </button>
      </div>

      {obreros.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <UserPlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            No tienes personal de campo registrado. Agrega el primero para darle acceso a tus tareas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex flex-col divide-y divide-slate-50">
            {obreros.map((o) => {
              const estado = getEstado(o);
              const especialidadLabel = o.especialidad
                ? ESPECIALIDAD_LABEL[o.especialidad as keyof typeof ESPECIALIDAD_LABEL] ?? o.especialidad
                : null;
              return (
                <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 truncate">{o.nombre}</span>
                      <EstadoBadge estado={estado} />
                      {especialidadLabel && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
                          {especialidadLabel}
                        </span>
                      )}
                      <ScoreBadge score={o.score_total} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {o.cedula && <span>CC {o.cedula}</span>}
                      {o.telefono && <span>📞 {o.telefono}</span>}
                      {o.direccion && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {o.direccion}
                        </span>
                      )}
                      {(o.contacto_emergencia || o.contacto_emergencia_telefono) && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {[o.contacto_emergencia, o.contacto_emergencia_telefono].filter(Boolean).join(" · ")}
                        </span>
                      )}
                      <span>
                        Expira:{" "}
                        {new Date(o.fecha_expiracion).toLocaleDateString("es-CO", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </span>
                      {(o.evidencias_aprobadas != null || o.tareas_completadas != null) && (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Award className="w-3 h-3" />
                          {o.tareas_completadas ?? 0} tareas · {o.evidencias_aprobadas ?? 0}✓ / {o.evidencias_rechazadas ?? 0}✗
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                    <button onClick={() => openEdit(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => copyLink(o.token)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Copiar enlace">
                      {copiedId === o.token ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setExtendId(o.id); setExtendDate(o.fecha_expiracion.slice(0, 10)); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title="Extender fecha">
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggleActive(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                      title={o.activo ? "Desactivar" : "Reactivar"}>
                      {o.activo ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    {o._count && o._count.evidencias === 0 && (
                      <button onClick={() => handleDelete(o.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        title="Eliminar">
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

      {/* Form Modal — crear / editar */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar personal de campo" : "Agregar personal de campo"}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
            )}

            {/* Información obligatoria */}
            <div className="mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Información básica <span className="text-red-500">*</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label="Nombre completo *" value={form.nombre}
                  onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Juan Pérez" />
                <Input label="Cédula *" value={form.cedula}
                  onChange={(v) => setForm({ ...form, cedula: v.replace(/\D/g, "") })} placeholder="1234567890" />
                <Input label="Teléfono *" value={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })} placeholder="3001234567" />
                <Select label="Especialidad *" value={form.especialidad}
                  onChange={(v) => setForm({ ...form, especialidad: v })}
                  options={[
                    { value: "", label: "Selecciona..." },
                    ...ESPECIALIDADES.map((e) => ({ value: e, label: ESPECIALIDAD_LABEL[e] })),
                  ]}
                />
                <Input label="EPS (opcional)" value={form.eps}
                  onChange={(v) => setForm({ ...form, eps: v })} placeholder="Ej: SURA, SANITAS" />
                <Input label="ARL (opcional)" value={form.arl}
                  onChange={(v) => setForm({ ...form, arl: v })} placeholder="Ej: SURA, POSITIVA" />
              </div>
            </div>

            {/* Vigencia */}
            <div className="mb-3">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Vigencia del acceso *</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha de inicio *" type="date" value={form.fecha_inicio}
                  onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
                <Input label="Fecha de expiración *" type="date" value={form.fecha_expiracion}
                  onChange={(v) => setForm({ ...form, fecha_expiracion: v })} />
              </div>
            </div>

            {/* Información adicional */}
            <details className="mb-4">
              <summary className="text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer mb-2">
                Información adicional (opcional)
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Input label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento}
                  onChange={(v) => setForm({ ...form, fecha_nacimiento: v })} />
                <Select label="Tipo de sangre" value={form.tipo_sangre}
                  onChange={(v) => setForm({ ...form, tipo_sangre: v })}
                  options={[
                    { value: "", label: "—" },
                    ...TIPOS_SANGRE.map((t) => ({ value: t, label: t })),
                  ]}
                />
                <Input label="Años de experiencia" type="number" value={form.anos_experiencia}
                  onChange={(v) => setForm({ ...form, anos_experiencia: v })} placeholder="0" />
                <Input label="Dirección" value={form.direccion}
                  onChange={(v) => setForm({ ...form, direccion: v })} placeholder="Calle 1 # 2-3" />
                <Input label="Contacto de emergencia" value={form.contacto_emergencia}
                  onChange={(v) => setForm({ ...form, contacto_emergencia: v })} placeholder="Nombre" />
                <Input label="Tel. contacto emergencia" value={form.contacto_emergencia_telefono}
                  onChange={(v) => setForm({ ...form, contacto_emergencia_telefono: v })} placeholder="3001234567" />
              </div>
            </details>

            <button
              onClick={handleSave}
              disabled={saving || !form.nombre.trim() || !form.cedula.trim() || !form.telefono.trim()
                || !form.especialidad
                || !form.fecha_inicio || !form.fecha_expiracion}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear personal de campo"}
            </button>
          </div>
        </div>
      )}

      {/* Link Modal después de crear */}
      {showLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Personal de campo creado</h3>
              <button onClick={() => setShowLink(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Comparte este enlace con la persona de campo para que pueda acceder a sus tareas:
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
              {linkCopied ? <><Check className="w-4 h-4" /> Enlace copiado</> : <><Copy className="w-4 h-4" /> Copiar enlace</>}
            </button>
          </div>
        </div>
      )}

      {/* Extender modal */}
      {extendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Extender acceso</h3>
              <button onClick={() => { setExtendId(null); setExtendDate(""); }}
                className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Input label="Nueva fecha de expiración" type="date" value={extendDate} onChange={setExtendDate} />
            <button
              onClick={handleExtend}
              disabled={extending || !extendDate}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm cursor-pointer"
            >
              {extending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {extending ? "Actualizando..." : "Actualizar fecha"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
      />
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
