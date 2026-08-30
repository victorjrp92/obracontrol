"use client";

import { Loader2, MapPin, Trash2 } from "lucide-react";
// Del submódulo y no del barril: `@/lib/documentos` reexporta el adaptador de
// Prisma, y esto es un componente de cliente. `fechas.ts` es solo Intl.
import { momentoEnColombia } from "@/lib/documentos/fechas";
import { coordenadasImpresas } from "./logica/marca-foto-inicial";
import type { FotoRegistroVista } from "./logica/vista-registro-inicial";

/**
 * Una foto del registro, con lo que la hace valer debajo: su número en el acta,
 * el instante de la captura y las coordenadas.
 *
 * Los tres datos se repiten fuera de la imagen aunque ya estén quemados dentro.
 * No es redundancia: dentro de la imagen son la prueba —viajan con el archivo y
 * no se pueden separar de él—, y aquí fuera son lo que permite revisarlos sin
 * abrir la foto a tamaño completo, que es lo que uno hace cuando está
 * comprobando que no falta ninguna habitación.
 */
export default function FotoRegistroCard({
  foto,
  numero,
  descartando = false,
  onDescartar,
}: {
  foto: FotoRegistroVista;
  /** El número con el que saldrá en el acta. */
  numero: number;
  descartando?: boolean;
  onDescartar: (id: string) => void;
}) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative bg-slate-100">
        {foto.url ? (
          // URL firmada temporal o `blob:` de una captura recién hecha; en los
          // dos casos es una fuente que `next/image` no puede optimizar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.url}
            alt={`Foto ${numero} de ${foto.espacio}`}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center text-xs text-slate-400">
            Vista previa no disponible
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white">
          {numero}
        </span>
        <button
          type="button"
          onClick={() => onDescartar(foto.id)}
          disabled={descartando}
          aria-label={`Descartar la foto ${numero}`}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-slate-600 transition-colors hover:bg-white hover:text-rose-600 disabled:opacity-60"
        >
          {descartando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      <figcaption className="flex flex-col gap-1 p-3">
        <p className="text-sm font-semibold text-slate-800">{foto.espacio}</p>
        {/* En hora de Colombia, no en la del navegador: es la misma que va
            quemada en la imagen y la que imprime el acta. Si el profesional
            está de viaje, las tres tienen que seguir diciendo lo mismo. */}
        <p className="text-xs text-slate-500">{momentoEnColombia(new Date(foto.capturadaEn))}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {coordenadasImpresas(foto)}
        </p>
        {foto.nota && <p className="text-xs italic text-slate-600">{foto.nota}</p>}
      </figcaption>
    </figure>
  );
}
