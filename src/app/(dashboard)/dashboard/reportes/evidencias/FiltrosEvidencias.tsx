"use client";

// ---------------------------------------------------------------------------
// Los dos controles del mapa de evidencias: qué obra y con qué radio.
//
// Van por URL y no por estado local por la misma razón que el selector de
// Reportes: un reporte de ubicación se comparte pegando el enlace —«mira esta
// foto a 4 km de la obra»— y volver atrás tiene que devolver lo que había, no
// la primera obra de la lista.
//
// Y hay una segunda razón, propia de esta pantalla: el radio NO se aplica en el
// cliente. Cambiarlo recalcula en el servidor cuántas de las 3.348 fotos caen
// fuera, y el contador de arriba y los colores del mapa salen de la MISMA
// cuenta. Filtrando en el cliente sobre una clasificación ya hecha, el contador
// y el mapa acabarían discrepando.
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { Ruler } from "lucide-react";
import { formatearDistancia, RADIOS_OBRA_METROS } from "@/lib/distancia-obra";

interface Props {
  obras: { id: string; nombre: string; ubicada: boolean }[];
  obraActiva: string;
  radioMetros: number;
}

export default function FiltrosEvidencias({ obras, obraActiva, radioMetros }: Props) {
  const router = useRouter();

  function ir(proyecto: string, radio: number) {
    router.push(`/dashboard/reportes/evidencias?proyecto=${proyecto}&radio=${radio}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {obras.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Obra</span>
          <select
            value={obraActiva}
            onChange={(e) => ir(e.target.value, radioMetros)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer max-w-[220px]"
          >
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
                {/* Se avisa en la propia lista: sin ubicación no hay distancias
                    que calcular, y es mejor saberlo antes de abrir la obra. */}
                {o.ubicada ? "" : " (sin ubicar)"}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Ruler className="w-3 h-3" /> Radio
        </span>
        <select
          value={radioMetros}
          onChange={(e) => ir(obraActiva, Number(e.target.value))}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
        >
          {RADIOS_OBRA_METROS.map((r) => (
            <option key={r} value={r}>
              {formatearDistancia(r)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
