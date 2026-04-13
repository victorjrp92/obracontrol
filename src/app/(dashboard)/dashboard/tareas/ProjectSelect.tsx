"use client";

import { useRouter } from "next/navigation";

interface Props {
  proyectos: { id: string; nombre: string }[];
  activeProyecto: string;
  activeFilter: string;
}

export default function ProjectSelect({ proyectos, activeProyecto, activeFilter }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sp = new URLSearchParams();
    sp.set("estado", activeFilter);
    const val = e.target.value;
    if (val) sp.set("proyecto", val);
    router.push(`/dashboard/tareas?${sp.toString()}`);
  }

  return (
    <select
      value={activeProyecto}
      onChange={handleChange}
      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
    >
      <option value="">Todos los proyectos</option>
      {proyectos.map((p) => (
        <option key={p.id} value={p.id}>{p.nombre}</option>
      ))}
    </select>
  );
}
