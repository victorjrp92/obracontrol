import { Building2 } from "lucide-react";

/** A qué está atado el producto — obra, piso o unidad —, siempre visible. */
export default function EtiquetaUbicacion({ etiqueta }: { etiqueta: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
      <Building2 className="w-3 h-3" />
      {etiqueta}
    </span>
  );
}
