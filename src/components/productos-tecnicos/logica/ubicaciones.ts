/**
 * El árbol de edificio → piso → unidad de una obra, en la forma mínima que
 * necesita el selector de ubicación del formulario de subida.
 */

export interface UnidadOpcion {
  id: string;
  nombre: string;
}

export interface PisoOpcion {
  id: string;
  numero: number;
  unidades: UnidadOpcion[];
}

export interface EdificioOpcion {
  id: string;
  nombre: string;
  pisos: PisoOpcion[];
}

/**
 * "Obra completa" / "Piso 3 · Torre A" / "Apto 501 · Piso 5 · Torre A" — a
 * qué está atado un producto técnico, en una frase que no obliga a cruzar
 * ids con el árbol de edificios a mano.
 */
export function etiquetaDeUbicacion(
  edificios: readonly EdificioOpcion[],
  pisoId: string | null,
  unidadId: string | null,
): string {
  if (unidadId) {
    for (const edificio of edificios) {
      for (const piso of edificio.pisos) {
        const unidad = piso.unidades.find((u) => u.id === unidadId);
        if (unidad) return `${unidad.nombre} · Piso ${piso.numero} · ${edificio.nombre}`;
      }
    }
    return "Unidad";
  }

  if (pisoId) {
    for (const edificio of edificios) {
      const piso = edificio.pisos.find((p) => p.id === pisoId);
      if (piso) return `Piso ${piso.numero} · ${edificio.nombre}`;
    }
    return "Piso";
  }

  return "Obra completa";
}
