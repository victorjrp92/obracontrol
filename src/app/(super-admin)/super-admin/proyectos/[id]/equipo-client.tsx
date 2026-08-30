"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Users, ClipboardList, HardHat } from "lucide-react";

interface AdminAsignado {
  accessId: string;
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
interface ObreroRow {
  id: string;
  nombre: string;
  contratista_id: string;
  expira: string;
}

interface Props {
  proyectoId: string;
  adminsAsignados: AdminAsignado[];
  adminsDisponibles: AdminDisponible[];
  contratistas: ContratistaRow[];
  obreros: ObreroRow[];
}

export default function EquipoClient({
  proyectoId,
  adminsAsignados,
  adminsDisponibles,
  contratistas,
  obreros,
}: Props) {
  const router = useRouter();
  const [asignar, setAsignar] = useState("");
  const [error, setError] = useState("");

  async function handleAsignar() {
    if (!asignar) return;
    setError("");
    const res = await fetch(`/api/super-admin/proyectos/${proyectoId}/admins`, {
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
    const res = await fetch(`/api/super-admin/proyectos/${proyectoId}/admins?usuario_id=${usuario_id}`, {
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
      <Section title={`Admin Juniors (${adminsAsignados.length})`} icon={Users}>
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {/* Asignar */}
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
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" /> Asignar
          </button>
        </div>

        {adminsAsignados.length === 0 ? (
          <Empty>Sin Admin Juniors asignados.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {adminsAsignados.map((a) => (
              <Row
                key={a.accessId}
                left={
                  <>
                    <div className="font-semibold text-sm text-slate-800 truncate">{a.nombre}</div>
                    <div className="text-xs text-slate-500 truncate">{a.email}</div>
                  </>
                }
                right={
                  <button
                    onClick={() => handleQuitar(a.usuario_id, a.nombre)}
                    className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50"
                    title="Quitar del proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
              />
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
              <Row
                key={c.id}
                left={
                  <>
                    <div className="font-semibold text-sm text-slate-800 truncate">{c.nombre}</div>
                    <div className="text-xs text-slate-500 truncate">{c.email} · {c.rol}</div>
                  </>
                }
                right={
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                      {c.tareas} tareas
                    </span>
                    <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-semibold">
                      {c.obreros} obreros
                    </span>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </Section>

      {/* Obreros */}
      <Section title={`Obreros activos (${obreros.length})`} icon={HardHat}>
        {obreros.length === 0 ? (
          <Empty>Sin personal de campo activos.</Empty>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {obreros.map((o) => (
              <Row
                key={o.id}
                left={
                  <>
                    <div className="font-semibold text-sm text-slate-800 truncate">{o.nombre}</div>
                    <div className="text-xs text-slate-500">
                      Expira: {new Date(o.expira).toLocaleDateString("es-CO")}
                    </div>
                  </>
                }
              />
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

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
      <div className="min-w-0 flex-1">{left}</div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 text-center py-4">{children}</p>;
}
