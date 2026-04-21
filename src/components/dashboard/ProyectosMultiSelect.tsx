"use client";

import { FolderOpen } from "lucide-react";

interface ProyectoOption {
  id: string;
  nombre: string;
}

interface Props {
  proyectos: ProyectoOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  required?: boolean;
}

export default function ProyectosMultiSelect({ proyectos, value, onChange, label = "Proyectos asignados", required = false }: Props) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="border border-slate-200 rounded-xl p-2 max-h-40 overflow-y-auto flex flex-col gap-1">
        {proyectos.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-1.5">No hay proyectos disponibles</p>
        )}
        {proyectos.map((p) => {
          const checked = value.includes(p.id);
          return (
            <label
              key={p.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${checked ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.id)}
                className="accent-blue-600"
              />
              <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>{p.nombre}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
