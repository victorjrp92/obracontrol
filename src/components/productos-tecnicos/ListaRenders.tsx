import { Image as ImageIcon, Plus } from "lucide-react";
import EstadoVacio from "./EstadoVacio";
import RenderCard from "./RenderCard";
import type { RenderVista } from "./logica/vista-planos";

export default function ListaRenders({
  renders,
  urls,
  cargandoId,
  onCargarImagen,
  onReemplazar,
  onSubirPrimero,
}: {
  renders: RenderVista[];
  urls: Record<string, string>;
  cargandoId: string | null;
  onCargarImagen: (id: string) => void;
  onReemplazar: (render: RenderVista) => void;
  onSubirPrimero: () => void;
}) {
  if (renders.length === 0) {
    return (
      <EstadoVacio
        icono={ImageIcon}
        titulo="Todavía no hay renders"
        descripcion="Sube aquí las imágenes de cómo se va a ver la obra terminada — de la torre completa, de una fachada o de una unidad. Un render nuevo sobre uno existente lo reemplaza; el anterior queda en el histórico, no se pierde."
        accion={
          <button
            type="button"
            onClick={onSubirPrimero}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Subir el primer render
          </button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {renders.map((render) => (
        <RenderCard
          key={render.id}
          render={render}
          url={urls[render.id] ?? null}
          cargando={cargandoId === render.id}
          onCargarImagen={() => onCargarImagen(render.id)}
          onReemplazar={() => onReemplazar(render)}
        />
      ))}
    </div>
  );
}
