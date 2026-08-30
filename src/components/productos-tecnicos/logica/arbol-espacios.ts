/**
 * El inmueble aplanado: la lista de espacios donde se puede tomar una foto del
 * registro inicial, cada uno con su dirección dentro de la obra.
 *
 * Sale de la jerarquía que ya tiene el modelo —Proyecto → Edificio → Piso →
 * Unidad → Espacio— y no la reinventa. Se aplana porque quien está de pie en
 * una cocina con el teléfono en la mano no navega tres selectores: elige
 * «Cocina · Apto 501 · Piso 5 · Torre A» de una lista y toma la foto.
 *
 * Vive aparte de `ubicaciones.ts` (planos y renders) a propósito: aquel árbol
 * llega hasta la unidad, porque un plano se ata a una unidad; este baja hasta el
 * espacio, porque una foto del estado previo se toma EN un espacio. Fundirlos
 * obligaría a la pantalla de planos a cargar todos los espacios de la obra para
 * no usarlos.
 *
 * Módulo puro: sin React, sin red, sin Prisma.
 */

export interface EspacioOpcion {
  id: string;
  nombre: string;
}

export interface UnidadConEspacios {
  id: string;
  nombre: string;
  espacios: EspacioOpcion[];
}

export interface PisoConUnidades {
  id: string;
  numero: number;
  unidades: UnidadConEspacios[];
}

export interface EdificioConPisos {
  id: string;
  nombre: string;
  pisos: PisoConUnidades[];
}

/** El inmueble entero, tal como lo devuelve la consulta de la pantalla. */
export type ArbolInmueble = readonly EdificioConPisos[];

/** Un espacio con su dirección completa dentro de la obra. */
export interface EspacioListado {
  espacioId: string;
  nombre: string;
  unidadId: string;
  unidadNombre: string;
  pisoId: string;
  pisoNumero: number;
  edificioId: string;
  edificioNombre: string;
  /** «Cocina · Apto 501 · Piso 5 · Torre A». Lo que se quema en la foto y se imprime. */
  ubicacion: string;
  /**
   * Posición en el recorrido del inmueble. Fija el orden de los espacios en el
   * acta: un documento que ordenara los espacios por la hora en que se tomó la
   * primera foto se leería como el itinerario del profesional, no como el
   * inmueble.
   */
  orden: number;
}

/** La dirección de un espacio, de lo pequeño a lo grande, como se lee. */
export function etiquetaUbicacionEspacio(datos: {
  espacio: string;
  unidad: string;
  piso: number;
  edificio: string;
}): string {
  return `${datos.espacio} · ${datos.unidad} · Piso ${datos.piso} · ${datos.edificio}`;
}

/**
 * Todos los espacios de la obra, en el orden del recorrido: edificio, piso,
 * unidad, espacio. Se respeta el orden en que llega el árbol —lo ordena la
 * consulta, que es quien sabe de `orderBy`— y solo se le añade el índice.
 */
export function listarEspacios(arbol: ArbolInmueble): EspacioListado[] {
  const listado: EspacioListado[] = [];

  for (const edificio of arbol) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        for (const espacio of unidad.espacios) {
          listado.push({
            espacioId: espacio.id,
            nombre: espacio.nombre,
            unidadId: unidad.id,
            unidadNombre: unidad.nombre,
            pisoId: piso.id,
            pisoNumero: piso.numero,
            edificioId: edificio.id,
            edificioNombre: edificio.nombre,
            ubicacion: etiquetaUbicacionEspacio({
              espacio: espacio.nombre,
              unidad: unidad.nombre,
              piso: piso.numero,
              edificio: edificio.nombre,
            }),
            orden: listado.length,
          });
        }
      }
    }
  }

  return listado;
}

/** Un espacio por su id, con toda su dirección. `null` si no es de esta obra. */
export function buscarEspacio(arbol: ArbolInmueble, espacioId: string): EspacioListado | null {
  return listarEspacios(arbol).find((e) => e.espacioId === espacioId) ?? null;
}

/** ¿La obra tiene al menos un espacio donde registrar? */
export function tieneEspacios(arbol: ArbolInmueble): boolean {
  return arbol.some((e) => e.pisos.some((p) => p.unidades.some((u) => u.espacios.length > 0)));
}
