"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Galería simple de fotos de avance para la vista del cliente (solo lectura).
 * Click en una miniatura abre un visor a pantalla completa.
 */
export default function ClienteGaleriaFotos({
  fotos,
  tareaNombre,
}: {
  fotos: string[];
  tareaNombre: string;
}) {
  const [activa, setActiva] = useState<number | null>(null);

  if (fotos.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {fotos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActiva(i)}
            className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 transition-all hover:border-emerald-300 hover:shadow-sm active:scale-95"
            aria-label={`Ver foto ${i + 1} de ${tareaNombre}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Avance de ${tareaNombre}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {activa !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setActiva(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${tareaNombre}`}
        >
          <button
            type="button"
            onClick={() => setActiva(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[activa]}
            alt={`Avance de ${tareaNombre}`}
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
