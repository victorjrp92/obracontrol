import { AlertTriangle, CheckCircle2, TriangleAlert } from "lucide-react";
import { TITULO_NIVEL } from "@/lib/alerta/copys";
import type { Nivel } from "@/lib/alerta/tipos";

const ICONO_NIVEL: Record<Nivel, typeof TriangleAlert> = {
  rojo: TriangleAlert,
  amarillo: AlertTriangle,
  verde: CheckCircle2,
};

const CLASE_NIVEL: Record<Nivel, string> = {
  rojo: "sem sem-rojo",
  amarillo: "sem sem-amarillo",
  verde: "sem sem-verde",
};

/**
 * Prioridad de revisión en lenguaje Juntos (spec: urgente / pronto / cuando
 * puedas). Acompaña al título del nivel (TITULO_NIVEL de copys.ts), nunca lo
 * reemplaza ni lo parafrasea.
 */
export const PRIORIDAD_NIVEL: Record<Nivel, string> = {
  rojo: "Revisión urgente",
  amarillo: "Revisión pronto",
  verde: "Revisión cuando puedas",
};

/** Badge de nivel re-vestido Aizome. Lee TITULO_NIVEL de copys.ts, tal cual. */
export default function SemaforoJuntos({ nivel }: { nivel: Nivel }) {
  const Icon = ICONO_NIVEL[nivel];
  return (
    <span className={CLASE_NIVEL[nivel]}>
      <Icon className="ic" aria-hidden="true" />
      {TITULO_NIVEL[nivel]}
    </span>
  );
}
