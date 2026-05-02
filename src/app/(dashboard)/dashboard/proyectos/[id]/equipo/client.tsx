"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Users, ClipboardList } from "lucide-react";

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

interface Props {
  proyectoId: string;
  canAssign: boolean;
  adminsAsignados: AdminAsignado[];
  adminsDisponibles: AdminDisponible[];
  contratistas: ContratistaRow[];
}

export default function EquipoAdminGeneral({
  proyectoId,
  canAssign,
  adminsAsignados,
  adminsDisponibles,
  contratistas,
}: Props) {
  const router = useRouter();
  const [asignar, setAsignar] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Admin Juniors */}
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
