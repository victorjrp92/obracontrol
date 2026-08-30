"use client";

import FotoRegistroCard from "./FotoRegistroCard";
import type { EspacioConFotos } from "./logica/vista-registro-inicial";

/**
 * Un espacio del inmueble con todas sus fotos juntas.
 *
 * El registro se organiza por espacio y no por orden de captura porque así se
 * revisa: la pregunta que uno se hace antes de emitir el acta es «¿me faltó
 * alguna habitación?», y esa pregunta solo se responde viendo el inmueble
 * agrupado, no el itinerario del profesional.
 */
export default function EspacioRegistroSection({
  espacio,
  numeros,
  descartandoId,
  onDescartar,
}: {
  espacio: EspacioConFotos;
  /** `id de foto` → número con el que sale en el acta. */
  numeros: ReadonlyMap<string, number>;
  descartandoId: string | null;
  onDescartar: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{espacio.nombre}</h3>
          <p className="text-xs text-slate-500">{espacio.ubicacion}</p>
        </div>
        <span className="text-xs text-slate-400">
          {espacio.fotos.length} {espacio.fotos.length === 1 ? "foto" : "fotos"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {espacio.fotos.map((foto) => (
          <FotoRegistroCard
            key={foto.id}
            foto={foto}
            numero={numeros.get(foto.id) ?? 0}
            descartando={descartandoId === foto.id}
            onDescartar={onDescartar}
          />
        ))}
      </div>
    </section>
  );
}
