"use client";

// ─────────────────────────────────────────────────────────────────────────
// EL EJE DE CALENDARIO de la línea de tiempo, dibujado COMO REJILLA.
//
// Se monta en `absolute inset-0` sobre la zona de barras, no como una fila
// aparte: así el rótulo del mes y la línea divisoria que le corresponde son
// literalmente el mismo elemento y no se pueden desalinear. El contenedor
// padre reserva arriba la banda de los rótulos con un padding.
//
// Va detrás de las barras (se monta ANTES en el DOM, mismo z) porque una
// divisoria de mes es fondo: si pinta encima, corta las barritas de espacio y
// se leen como si estuvieran partidas en dos tareas.
// ─────────────────────────────────────────────────────────────────────────

import type { SegmentoMes } from "@/lib/cronograma/eje-meses";

/** Ancho mínimo, en % del eje, para que quepa un rótulo de tres letras. */
const MINIMO_PARA_ROTULO = 7;

export default function EjeCalendario({ meses }: { meses: SegmentoMes[] }) {
  if (meses.length === 0) return null;

  return (
    // Decorativo para lectores de pantalla: cada barra ya lleva sus fechas
    // completas en `title`, y una ristra de "sep oct nov" suelta sería ruido.
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {meses.map((m, i) => (
        <div
          key={`${m.anio}-${m.mes}`}
          className={`absolute top-0 bottom-0 overflow-hidden ${
            i === 0 ? "" : "border-l border-slate-200"
          }`}
          style={{ left: `${m.desdePct}%`, width: `${m.anchoPct}%` }}
        >
          <span className="block pl-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            {m.anchoPct >= MINIMO_PARA_ROTULO ? m.etiqueta : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
