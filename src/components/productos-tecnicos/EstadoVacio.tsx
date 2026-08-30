import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * "Sin planos" no ayuda a nadie: hay que decir qué se sube aquí y para qué
 * sirve. Se usa para los tres estados vacíos del módulo (planos, renders, y
 * el módulo entero antes de la primera subida).
 */
export default function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-6 bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl">
      <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center">
        <Icono className="w-6 h-6 text-slate-400" />
      </div>
      <div>
        <p className="font-semibold text-slate-800">{titulo}</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{descripcion}</p>
      </div>
      {accion}
    </div>
  );
}
