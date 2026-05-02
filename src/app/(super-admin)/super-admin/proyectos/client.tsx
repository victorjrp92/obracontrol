"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FolderOpen, Trash2, Users } from "lucide-react";

interface Proyecto {
  id: string;
  nombre: string;
  numeroRegistro: string | null;
  estado: string;
  constructora_id: string;
  constructora_nombre: string;
  edificios: number;
  adminsAsignados: number;
}

export default function ProyectosClient({ proyectos }: { proyectos: Proyecto[] }) {
  const router = useRouter();

  async function handleDelete(p: Proyecto) {
    if (!confirm(`¿Eliminar el proyecto "${p.nombre}"? Borrará todas sus tareas, edificios y evidencias. NO se puede deshacer.`)) return;
    const res = await fetch(`/api/super-admin/proyectos/${p.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al eliminar");
    }
  }

  if (proyectos.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-10">
        No hay proyectos en el sistema todavía.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {proyectos.map((p) => (
        <div
          key={p.id}
          className="bg-white rounded-2xl border border-slate-100 hover:border-red-200 hover:shadow-md p-5 transition-all"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              {p.numeroRegistro && (
                <span className="inline-block font-mono text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded mb-1">
                  {p.numeroRegistro}
                </span>
              )}
              <Link
                href={`/super-admin/proyectos/${p.id}`}
                className="font-bold text-slate-800 hover:text-red-600 truncate block"
              >
                {p.nombre}
              </Link>
              <Link
                href={`/super-admin/constructoras/${p.constructora_id}`}
                className="text-xs text-slate-500 hover:text-red-600 truncate block"
              >
                {p.constructora_nombre}
              </Link>
            </div>
            <button
              onClick={() => handleDelete(p)}
              className="text-red-600 hover:text-red-700 p-1.5 rounded hover:bg-red-50 flex-shrink-0"
              title="Eliminar proyecto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <Link
            href={`/super-admin/proyectos/${p.id}`}
            className="grid grid-cols-3 gap-2 text-xs mt-3 hover:opacity-80"
          >
            <Stat label="Estado" value={p.estado} />
            <Stat label="Edificios" value={String(p.edificios)} />
            <Stat
              label="Admins"
              value={String(p.adminsAsignados)}
              icon={<Users className="w-3 h-3 text-slate-400" />}
            />
          </Link>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <div className="text-slate-400 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="font-bold text-slate-700 truncate">{value}</div>
    </div>
  );
}
