import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";
import { TITULO_NIVEL, TONO_NIVEL } from "@/lib/alerta/copys";
import type { Nivel } from "@/lib/alerta/tipos";

const ICONO_NIVEL: Record<Nivel, typeof TriangleAlert> = {
  rojo: TriangleAlert,
  amarillo: AlertTriangle,
  verde: CheckCircle2,
};

const TAMANO: Record<"sm" | "md", { badge: string; icon: string }> = {
  sm: { badge: "px-3 py-1 text-xs", icon: "h-3.5 w-3.5" },
  md: { badge: "px-4 py-2 text-sm", icon: "h-4 w-4" },
};

/** Badge de nivel reutilizable (Paso 3 y 4). Lee TITULO_NIVEL/TONO_NIVEL de copys.ts. */
export default function SemaforoNivel({ nivel, tamano = "md" }: { nivel: Nivel; tamano?: "sm" | "md" }) {
  const tono = TONO_NIVEL[nivel];
  const Icon = ICONO_NIVEL[nivel];
  const t = TAMANO[tamano];
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full border font-bold ${tono.bg} ${tono.border} ${tono.text} ${t.badge}`}
    >
      <Icon className={`${t.icon} ${tono.icon}`} />
      {TITULO_NIVEL[nivel]}
    </span>
  );
}
