"use client";

import type { EspacioListado } from "./logica/arbol-espacios";

/**
 * En qué espacio se está tomando la foto.
 *
 * Es un desplegable sobre la lista aplanada del inmueble, no tres selectores
 * encadenados: quien lo usa está de pie en una cocina con el teléfono en la
 * mano, y encadenar edificio → piso → unidad → espacio son tres toques de más
 * cada vez que cambia de habitación.
 *
 * El espacio se ESCOGE, nunca se escribe. Un campo de texto libre dejaría en el
 * documento nombres que no corresponden a ninguna parte del inmueble
 * registrado, y entonces «la foto 3, en la cocina» no se podría atar a nada.
 */
export default function SelectorEspacioRegistro({
  espacios,
  espacioId,
  disabled = false,
  onCambiar,
}: {
  espacios: readonly EspacioListado[];
  espacioId: string | null;
  disabled?: boolean;
  onCambiar: (espacioId: string | null) => void;
}) {
  const grupos = new Map<string, EspacioListado[]>();
  for (const espacio of espacios) {
    const clave = `${espacio.edificioNombre} · Piso ${espacio.pisoNumero} · ${espacio.unidadNombre}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(espacio);
    else grupos.set(clave, [espacio]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="espacio-registro" className="text-xs font-semibold text-slate-600">
        Espacio del inmueble
      </label>
      <select
        id="espacio-registro"
        value={espacioId ?? ""}
        disabled={disabled}
        onChange={(e) => onCambiar(e.target.value || null)}
        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-50"
      >
        <option value="">Selecciona el espacio…</option>
        {[...grupos.entries()].map(([etiqueta, delGrupo]) => (
          <optgroup key={etiqueta} label={etiqueta}>
            {delGrupo.map((espacio) => (
              <option key={espacio.espacioId} value={espacio.espacioId}>
                {espacio.nombre}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
