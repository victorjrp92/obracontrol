import type { NivelUbicacion } from "@/lib/productos-tecnicos";
import type { EdificioOpcion } from "./logica/ubicaciones";

export type { EdificioOpcion, PisoOpcion, UnidadOpcion } from "./logica/ubicaciones";

/**
 * A qué se ata el archivo: la obra entera, un piso, o una unidad. Piso y
 * unidad son excluyentes (regla del dominio, `ubicacion.ts`) — por eso es un
 * selector de nivel, no dos checkboxes independientes.
 */
export default function SelectorUbicacion({
  edificios,
  nivel,
  pisoId,
  unidadId,
  onCambiar,
}: {
  edificios: EdificioOpcion[];
  nivel: NivelUbicacion;
  pisoId: string | null;
  unidadId: string | null;
  onCambiar: (siguiente: { nivel: NivelUbicacion; pisoId: string | null; unidadId: string | null }) => void;
}) {
  const pisoActual = edificios.flatMap((e) => e.pisos).find((p) => p.id === pisoId) ?? null;
  const pisosDisponibles = edificios.flatMap((e) =>
    e.pisos.map((p) => ({ ...p, edificioNombre: e.nombre })),
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600">Dónde va</label>
      <div className="flex gap-1.5 flex-wrap">
        {(
          [
            { valor: "OBRA" as const, etiqueta: "Obra completa" },
            { valor: "PISO" as const, etiqueta: "Un piso" },
            { valor: "UNIDAD" as const, etiqueta: "Una unidad" },
          ]
        ).map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => onCambiar({ nivel: opcion.valor, pisoId: null, unidadId: null })}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              nivel === opcion.valor
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      {pisosDisponibles.length === 0 && (nivel === "PISO" || nivel === "UNIDAD") ? (
        <p className="text-xs text-amber-600">
          Esta obra todavía no tiene pisos registrados. Sube el archivo a la obra completa, o crea la
          estructura de torres y pisos primero.
        </p>
      ) : (
        <>
          {nivel === "PISO" && (
            <select
              value={pisoId ?? ""}
              onChange={(e) => onCambiar({ nivel: "PISO", pisoId: e.target.value || null, unidadId: null })}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">Selecciona un piso…</option>
              {pisosDisponibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.edificioNombre} · Piso {p.numero}
                </option>
              ))}
            </select>
          )}

          {nivel === "UNIDAD" && (
            <div className="flex flex-col gap-2">
              <select
                value={pisoId ?? ""}
                onChange={(e) => onCambiar({ nivel: "UNIDAD", pisoId: e.target.value || null, unidadId: null })}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Selecciona un piso…</option>
                {pisosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.edificioNombre} · Piso {p.numero}
                  </option>
                ))}
              </select>
              {pisoActual && (
                <select
                  value={unidadId ?? ""}
                  onChange={(e) => onCambiar({ nivel: "UNIDAD", pisoId, unidadId: e.target.value || null })}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Selecciona una unidad…</option>
                  {pisoActual.unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
