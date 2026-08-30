import { ImageIcon, Loader2, RefreshCw } from "lucide-react";
import EtiquetaUbicacion from "./EtiquetaUbicacion";
import { formatearFecha } from "./logica/formato-fecha";
import type { RenderVista } from "./logica/vista-planos";

/**
 * Un render es una imagen grande y el ancho de banda en obra es malo: NO se
 * carga sola. Empieza como una tarjeta liviana con un botón — el archivo
 * pesado solo baja cuando alguien decide que lo quiere ver.
 */
export default function RenderCard({
  render,
  url,
  cargando,
  onCargarImagen,
  onReemplazar,
}: {
  render: RenderVista;
  url: string | null;
  cargando: boolean;
  onCargarImagen: () => void;
  onReemplazar: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="aspect-video bg-slate-50 flex items-center justify-center">
        {url ? (
          // La URL es firmada y temporal (Supabase Storage): no es un asset
          // de /public, así que next/image no aplica aquí.
          <img src={url} alt={render.nombre} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <button
            type="button"
            onClick={onCargarImagen}
            disabled={cargando}
            className="flex flex-col items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors py-8 disabled:opacity-60"
          >
            {cargando ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
            <span className="text-xs font-medium">{cargando ? "Cargando…" : "Toca para ver el render"}</span>
          </button>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{render.nombre}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatearFecha(render.fecha)} · {render.subidoPor}
            </p>
          </div>
          <button
            type="button"
            onClick={onReemplazar}
            title="Subir un render nuevo en su lugar"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Reemplazar</span>
          </button>
        </div>
        <div className="mt-2">
          <EtiquetaUbicacion etiqueta={render.ubicacionEtiqueta} />
        </div>
      </div>
    </div>
  );
}
