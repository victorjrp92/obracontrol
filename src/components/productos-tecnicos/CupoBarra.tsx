import { AlertTriangle } from "lucide-react";
import { cupoParaPintar, type NivelCupo } from "./logica/vista-cupo";
import type { EstadoCupo } from "@/lib/productos-tecnicos";

const ESTILO_BARRA: Record<NivelCupo, string> = {
  ok: "bg-blue-500",
  aviso: "bg-amber-500",
  critico: "bg-red-600",
};

const ESTILO_TEXTO: Record<NivelCupo, string> = {
  ok: "text-slate-600",
  aviso: "text-amber-700",
  critico: "text-red-700",
};

/**
 * El cupo, visible ANTES de que alguien intente subir un archivo que no cabe.
 * Se pinta arriba del todo, siempre — no solo cuando está por llenarse — para
 * que quien va a subir un archivo grande sepa de entrada si tiene espacio.
 */
export default function CupoBarra({ estado }: { estado: EstadoCupo }) {
  const vista = cupoParaPintar(estado);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">Espacio de la obra</span>
        <span className={`text-sm font-bold ${ESTILO_TEXTO[vista.nivel]}`}>
          {vista.usadoLegible} de {vista.limiteLegible} ({vista.porcentaje}%)
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${ESTILO_BARRA[vista.nivel]}`}
          style={{ width: `${Math.max(vista.porcentaje, vista.porcentaje > 0 ? 3 : 0)}%` }}
        />
      </div>
      {vista.nivel !== "ok" && (
        <p className={`flex items-center gap-1.5 text-xs mt-2 ${ESTILO_TEXTO[vista.nivel]}`}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {vista.nivel === "critico"
            ? `Quedan ${vista.restanteLegible} libres. Los archivos grandes pueden no caber.`
            : `Quedan ${vista.restanteLegible} libres.`}
        </p>
      )}
    </div>
  );
}
