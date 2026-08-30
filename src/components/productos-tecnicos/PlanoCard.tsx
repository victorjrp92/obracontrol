"use client";

import { useState } from "react";
import { ChevronDown, FileUp } from "lucide-react";
import EtiquetaUbicacion from "./EtiquetaUbicacion";
import VersionPlanoRow from "./VersionPlanoRow";
import type { PlanoAgrupado } from "./logica/vista-planos";

/**
 * Un plano completo: la vigente siempre visible arriba; las anteriores
 * "accesibles pero visualmente apagadas" detrás de un toggle — accesibles de
 * un toque, no escondidas, pero tampoco compitiendo por la atención con la
 * que importa de verdad.
 */
export default function PlanoCard({
  plano,
  descargandoId,
  restaurandoId,
  onDescargar,
  onUsarEstaVersion,
  onSubirVersionNueva,
}: {
  plano: PlanoAgrupado;
  descargandoId: string | null;
  restaurandoId: string | null;
  onDescargar: (id: string) => void;
  onUsarEstaVersion: (id: string) => void;
  onSubirVersionNueva: (plano: PlanoAgrupado) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const vigente = plano.versiones.find((v) => v.vigente) ?? plano.versiones[0];
  const anteriores = plano.versiones.filter((v) => v.id !== vigente?.id);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 truncate">{plano.nombre}</h3>
          <div className="mt-1">
            <EtiquetaUbicacion etiqueta={plano.ubicacionEtiqueta} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSubirVersionNueva(plano)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Subir versión nueva</span>
        </button>
      </div>

      {vigente && (
        <VersionPlanoRow
          version={vigente}
          descargando={descargandoId === vigente.id}
          restaurando={restaurandoId === vigente.id}
          onDescargar={() => onDescargar(vigente.id)}
        />
      )}

      {anteriores.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-1 py-1"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? "rotate-180" : ""}`} />
            {abierto ? "Ocultar" : "Ver"} {anteriores.length}{" "}
            {anteriores.length === 1 ? "versión anterior" : "versiones anteriores"}
          </button>
          {abierto && (
            <div className="flex flex-col gap-1.5 mt-1.5">
              {anteriores.map((v) => (
                <VersionPlanoRow
                  key={v.id}
                  version={v}
                  descargando={descargandoId === v.id}
                  restaurando={restaurandoId === v.id}
                  onDescargar={() => onDescargar(v.id)}
                  onUsarEstaVersion={() => onUsarEstaVersion(v.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
