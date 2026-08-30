import { FileText, Plus } from "lucide-react";
import EstadoVacio from "./EstadoVacio";
import PlanoCard from "./PlanoCard";
import type { PlanoAgrupado } from "./logica/vista-planos";

export default function ListaPlanos({
  planos,
  descargandoId,
  restaurandoId,
  onDescargar,
  onUsarEstaVersion,
  onSubirVersionNueva,
  onSubirPrimero,
}: {
  planos: PlanoAgrupado[];
  descargandoId: string | null;
  restaurandoId: string | null;
  onDescargar: (id: string) => void;
  onUsarEstaVersion: (id: string) => void;
  onSubirVersionNueva: (plano: PlanoAgrupado) => void;
  onSubirPrimero: () => void;
}) {
  if (planos.length === 0) {
    return (
      <EstadoVacio
        icono={FileText}
        titulo="Todavía no hay planos"
        descripcion="Sube aquí los planos de implantación, distribución y acabados de la obra. Cada archivo nuevo que subas sobre un plano existente queda como su versión más reciente — la anterior no se borra, solo pasa a histórico."
        accion={
          <button
            type="button"
            onClick={onSubirPrimero}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Subir el primer plano
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {planos.map((plano) => (
        <PlanoCard
          key={plano.id}
          plano={plano}
          descargandoId={descargandoId}
          restaurandoId={restaurandoId}
          onDescargar={onDescargar}
          onUsarEstaVersion={onUsarEstaVersion}
          onSubirVersionNueva={onSubirVersionNueva}
        />
      ))}
    </div>
  );
}
