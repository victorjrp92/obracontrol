"use client";

// ---------------------------------------------------------------------------
// Selector de obra del modulo de Reportes.
//
// Va por URL y no por estado local a proposito: el reporte de una obra tiene
// que poder compartirse pegando el enlace, y volver atras en el navegador
// tiene que devolver la obra anterior y no la primera de la lista.
//
// Es uno propio y no el de Tareas porque aquel arma la ruta de /dashboard/tareas
// con sus filtros de estado y fase; compartirlo obligaria a parametrizar una
// pantalla que hoy funciona, para ahorrarse quince lineas.
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";

export default function SelectorObraReporte({
  proyectos,
  activo,
}: {
  proyectos: { id: string; nombre: string }[];
  activo: string;
}) {
  const router = useRouter();

  if (proyectos.length <= 1) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Obra</span>
      <select
        value={activo}
        onChange={(e) => router.push(`/dashboard/reportes?proyecto=${e.target.value}`)}
        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer max-w-[220px]"
      >
        {proyectos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
