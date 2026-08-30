"use client";

import { Loader2, Trash2, TriangleAlert } from "lucide-react";
// Del submódulo y no del barril: el barril arrastra el adaptador de Prisma y
// esto es un componente de cliente. `fechas.ts` es solo Intl.
import { momentoEnColombia } from "@/lib/documentos/fechas";
import type { FotoSinMarca } from "./logica/vista-registro-inicial";

/**
 * Las fotos que están en el registro de la obra pero no llevan fecha, hora y
 * ubicación quemadas.
 *
 * Existe por una razón muy concreta: el acta se NIEGA a emitirse mientras haya
 * una sola foto así, y esa negativa es deliberada —una foto sin fecha dentro de
 * un documento que se presenta como prueba del estado previo es exactamente lo
 * que no puede pasar—. Pero una regla estricta sin salida es una trampa: sin
 * este bloque, una foto que llegara por otra vía dejaría la obra sin poder
 * emitir su acta y sin nada en pantalla que dijera por qué.
 *
 * Así que se enseñan, se explica qué les falta, y se pueden descartar. Lo que no
 * se puede es incluirlas.
 */
export default function FotosSinMarcaAviso({
  fotos,
  descartandoId,
  onDescartar,
}: {
  fotos: readonly FotoSinMarca[];
  descartandoId: string | null;
  onDescartar: (id: string) => void;
}) {
  if (fotos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">
            {fotos.length === 1
              ? "Hay una imagen que no pertenece al registro"
              : `Hay ${fotos.length} imágenes que no pertenecen al registro`}
          </p>
          <p className="mt-1 leading-relaxed">
            No llevan la fecha, la hora y la ubicación impresas dentro de la imagen, así que no
            prueban cuándo se tomaron. El acta no se emite mientras estén aquí: descártalas y, si
            hacen falta, vuelve a tomar esas fotos con la cámara.
          </p>
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {fotos.map((foto) => (
          <li
            key={foto.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{foto.nombre || "Sin nombre"}</p>
              <p className="text-xs text-slate-500">
                Subida el {momentoEnColombia(new Date(foto.subidaEl))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDescartar(foto.id)}
              disabled={descartandoId === foto.id}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
            >
              {descartandoId === foto.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Descartar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
