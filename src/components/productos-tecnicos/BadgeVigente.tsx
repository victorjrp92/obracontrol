import { CheckCircle2 } from "lucide-react";

/**
 * La marca que tiene que verse "de un vistazo, en un celular, a pleno sol,
 * sin leer": la vigente es un bloque sólido con ícono; las demás son texto
 * plano, sin relleno, sin ícono. La diferencia no depende de leer la palabra.
 */
export default function BadgeVigente({ vigente }: { vigente: boolean }) {
  if (vigente) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-green-600 px-2.5 py-1 rounded-full">
        <CheckCircle2 className="w-3.5 h-3.5" />
        VIGENTE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs font-medium text-slate-400 px-2.5 py-1">
      Versión anterior
    </span>
  );
}
