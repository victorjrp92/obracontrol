"use client";

import { useRouter } from "next/navigation";

interface Props {
  fases: { id: string; nombre: string }[];
  activeFase: string;
  activeFilter: string;
  activeProyecto: string;
}

export default function FaseSelect({ fases, activeFase, activeFilter, activeProyecto }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams();
    sp.set("estado", activeFilter);
    if (activeProyecto) sp.set("proyecto", activeProyecto);
    const val = e.target.value;
    if (val) sp.set("fase", val);
    router.push(`/dashboard/tareas?${sp.toString()}`);
  }

  return (
    <select
      value={activeFase}
      onChange={handleChange}
      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
    >
      <option value="">Todas las fases</option>
      {fases.map((f) => (
        <option key={f.id} value={f.id}>{f.nombre}</option>
      ))}
    </select>
  );
}
