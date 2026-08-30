import { Download, History, Loader2 } from "lucide-react";
import BadgeVigente from "./BadgeVigente";
import { formatearFechaHora } from "./logica/formato-fecha";
import type { VersionVista } from "./logica/vista-planos";

/**
 * Una fila = una versión. La vigente se pinta a plena opacidad; el resto,
 * apagado (`opacity-60`) — es lo que hace que la diferencia se vea sin leer.
 */
export default function VersionPlanoRow({
  version,
  descargando,
  restaurando,
  onDescargar,
  onUsarEstaVersion,
}: {
  version: VersionVista;
  descargando: boolean;
  restaurando: boolean;
  onDescargar: () => void;
  onUsarEstaVersion?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-3 px-3 sm:px-4 rounded-xl transition-opacity ${
        version.vigente ? "bg-green-50/60 border border-green-100" : "opacity-60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">Versión {version.version}</span>
          <BadgeVigente vigente={version.vigente} />
        </div>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {formatearFechaHora(version.fecha)} · Subido por {version.subidoPor}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onDescargar}
          disabled={descargando}
          title="Ver / descargar"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {descargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Ver</span>
        </button>

        {!version.vigente && onUsarEstaVersion && (
          <button
            type="button"
            onClick={onUsarEstaVersion}
            disabled={restaurando}
            title="Volver a marcar esta versión como vigente"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-200 hover:border-amber-300 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {restaurando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Usar esta</span>
          </button>
        )}
      </div>
    </div>
  );
}
