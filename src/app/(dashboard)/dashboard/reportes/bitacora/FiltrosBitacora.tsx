"use client";

// ---------------------------------------------------------------------------
// Los filtros de la bitacora: persona, fase, torre y rango de fechas.
//
// Van por URL y no por estado local, como el resto de Reportes: «mandame el
// enlace de lo que Pedro devolvio en agosto» tiene que ser un enlace, y volver
// atras en el navegador tiene que devolver el filtro anterior.
//
// Cambiar de OBRA borra los demas filtros a proposito. La persona, la fase y la
// torre son ids de ESTA obra; arrastrarlos a otra no da un filtro raro, da cero
// resultados y la sensacion de que la obra nueva no tiene bitacora.
// ---------------------------------------------------------------------------

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface Opcion {
  id: string;
  nombre: string;
}

export interface ValoresFiltro {
  proyecto: string;
  persona: string;
  fase: string;
  torre: string;
  desde: string;
  hasta: string;
}

const RUTA = "/dashboard/reportes/bitacora";

export default function FiltrosBitacora({
  proyectos,
  personas,
  fases,
  torres,
  valores,
}: {
  proyectos: Opcion[];
  personas: Opcion[];
  fases: Opcion[];
  torres: Opcion[];
  valores: ValoresFiltro;
}) {
  const router = useRouter();

  /** Cambia UN filtro y vuelve a la primera pagina: la 7 de otro filtro no existe. */
  function cambiar(clave: keyof ValoresFiltro, valor: string) {
    if (clave === "proyecto") {
      router.push(`${RUTA}?proyecto=${encodeURIComponent(valor)}`);
      return;
    }
    const sp = new URLSearchParams();
    sp.set("proyecto", valores.proyecto);
    const siguientes: ValoresFiltro = { ...valores, [clave]: valor };
    for (const k of ["persona", "fase", "torre", "desde", "hasta"] as const) {
      if (siguientes[k]) sp.set(k, siguientes[k]);
    }
    router.push(`${RUTA}?${sp.toString()}`);
  }

  const hayFiltros = Boolean(
    valores.persona || valores.fase || valores.torre || valores.desde || valores.hasta,
  );

  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {proyectos.length > 1 && (
        <Campo etiqueta="Obra">
          <Select
            value={valores.proyecto}
            onChange={(v) => cambiar("proyecto", v)}
            opciones={proyectos}
          />
        </Campo>
      )}

      <Campo etiqueta="Persona">
        <Select
          value={valores.persona}
          onChange={(v) => cambiar("persona", v)}
          opciones={personas}
          vacio="Todas"
        />
      </Campo>

      {fases.length > 0 && (
        <Campo etiqueta="Fase">
          <Select
            value={valores.fase}
            onChange={(v) => cambiar("fase", v)}
            opciones={fases}
            vacio="Todas"
          />
        </Campo>
      )}

      {torres.length > 1 && (
        <Campo etiqueta="Torre">
          <Select
            value={valores.torre}
            onChange={(v) => cambiar("torre", v)}
            opciones={torres}
            vacio="Todas"
          />
        </Campo>
      )}

      <Campo etiqueta="Desde">
        <input
          type="date"
          value={valores.desde}
          max={valores.hasta || undefined}
          onChange={(e) => cambiar("desde", e.target.value)}
          className={claseControl}
        />
      </Campo>

      <Campo etiqueta="Hasta">
        <input
          type="date"
          value={valores.hasta}
          min={valores.desde || undefined}
          onChange={(e) => cambiar("hasta", e.target.value)}
          className={claseControl}
        />
      </Campo>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => router.push(`${RUTA}?proyecto=${encodeURIComponent(valores.proyecto)}`)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-500 hover:border-slate-300"
        >
          <X className="w-3.5 h-3.5" /> Limpiar
        </button>
      )}
    </div>
  );
}

const claseControl =
  "text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer max-w-[220px]";

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {etiqueta}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  opciones,
  vacio,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: Opcion[];
  vacio?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={claseControl}>
      {vacio && <option value="">{vacio}</option>}
      {opciones.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nombre}
        </option>
      ))}
    </select>
  );
}
