"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Save, X, Building2, FolderOpen, Users } from "lucide-react";

interface Constructora {
  id: string;
  nombre: string;
  nit: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  sitio_web: string;
  plan_suscripcion: "OBRA" | "PROYECTO" | "EMPRESA";
}

interface Proyecto {
  id: string;
  nombre: string;
  estado: string;
  adminsAsignados: number;
}

interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  rol_nivel: string;
  proyectos_asignados: number;
}

interface Props {
  constructora: Constructora;
  proyectos: Proyecto[];
  usuarios: UsuarioRow[];
}

export default function ConstructoraDetalleClient({ constructora, proyectos, usuarios }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState(constructora);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/super-admin/constructoras/${constructora.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  async function handleDeleteConstructora() {
    if (!confirm(`¿Eliminar "${constructora.nombre}"? Esto borra TODOS sus proyectos, usuarios y datos. NO se puede deshacer.`)) return;
    if (!confirm(`Confirmación final: borrar ${constructora.nombre} y todo su contenido?`)) return;

    const res = await fetch(`/api/super-admin/constructoras/${constructora.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/super-admin/constructoras");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar");
    }
  }

  async function handleDeleteUsuario(u: UsuarioRow) {
    if (!confirm(`¿Eliminar a ${u.nombre} (${u.email})?`)) return;
    const res = await fetch(`/api/super-admin/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar usuario");
    }
  }

  async function handleDeleteProyecto(p: Proyecto) {
    if (!confirm(`¿Eliminar el proyecto "${p.nombre}"? Borrará todas sus tareas y evidencias.`)) return;
    const res = await fetch(`/api/super-admin/proyectos/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sección 1 — Información de la empresa */}
      <Section
        title="Información de la empresa"
        icon={Building2}
        action={
          editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setData(constructora); setError(""); }}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 px-2 py-1 rounded"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold px-2 py-1 rounded"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 px-2 py-1 rounded"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={handleDeleteConstructora}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar empresa
              </button>
            </div>
          )
        }
      >
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nombre" value={data.nombre} editing={editing} onChange={(v) => setData({ ...data, nombre: v })} />
          <Field label="NIT" value={data.nit} editing={editing} onChange={(v) => setData({ ...data, nit: v })} />
          <Field label="Ciudad" value={data.ciudad} editing={editing} onChange={(v) => setData({ ...data, ciudad: v })} />
          <Field label="Dirección" value={data.direccion} editing={editing} onChange={(v) => setData({ ...data, direccion: v })} />
          <Field label="Teléfono" value={data.telefono} editing={editing} onChange={(v) => setData({ ...data, telefono: v })} />
          <Field label="Sitio web" value={data.sitio_web} editing={editing} onChange={(v) => setData({ ...data, sitio_web: v })} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Plan suscripción</span>
            {editing ? (
              <select
                value={data.plan_suscripcion}
                onChange={(e) => setData({ ...data, plan_suscripcion: e.target.value as never })}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="OBRA">OBRA</option>
                <option value="PROYECTO">PROYECTO</option>
                <option value="EMPRESA">EMPRESA</option>
              </select>
            ) : (
              <span className="text-sm font-semibold text-slate-800">{data.plan_suscripcion}</span>
            )}
          </div>
        </div>
      </Section>

      {/* Sección 2 — Proyectos */}
      <Section title={`Proyectos (${proyectos.length})`} icon={FolderOpen}>
        {proyectos.length === 0 ? (
          <Empty>Sin proyectos.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {proyectos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{p.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {p.estado} · {p.adminsAsignados} admin{p.adminsAsignados === 1 ? "" : "s"} junior asignado{p.adminsAsignados === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteProyecto(p)}
                  className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                  title="Eliminar proyecto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Sección 3 — Usuarios */}
      <Section
        title={`Usuarios (${usuarios.length})`}
        icon={Users}
        action={
          <Link
            href={`/super-admin/admins-generales?constructora=${constructora.id}`}
            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            + Admin General
          </Link>
        }
      >
        {usuarios.length === 0 ? (
          <Empty>Sin usuarios.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-slate-800 truncate">{u.nombre}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md">
                    {u.rol}
                  </span>
                  {u.rol_nivel === "ADMIN_PROYECTO" && (
                    <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded">
                      {u.proyectos_asignados} proy
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteUsuario(u)}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                    title="Eliminar usuario"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-slate-800">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      {editing ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400"
        />
      ) : (
        <span className="text-sm font-semibold text-slate-800">{value || "—"}</span>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 text-center py-4">{children}</p>;
}
