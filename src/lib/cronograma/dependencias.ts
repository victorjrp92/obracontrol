// ─────────────────────────────────────────────────────────────────────────
// La CADENA de `Tarea.depende_de` que se persiste al crear la obra.
//
// El campo lleva meses en el esquema y no lo escribía nadie: existe la
// columna, existe la relación de Prisma, y ninguna tarea del sistema apunta
// a otra. Sin él el usuario no puede VER ni EDITAR su cronograma — solo una
// lista de tareas sin orden.
//
// `depende_de` admite UN predecesor, así que dentro de cada espacio se
// escribe una CADENA en orden constructivo: la primera tarea del espacio no
// depende de nadie y cada una de las siguientes depende de la anterior. Entre
// espacios NO se encadena nada, y eso es justo el punto de esta fase: el baño
// 2 no espera a que termine el baño 1.
//
// Módulo puro y sin dominio: recibe el orden constructivo ya resuelto.
// ─────────────────────────────────────────────────────────────────────────

export interface EslabonCadena {
  /** Índice de la tarea en la lista original que recibió la función. */
  indice: number;
  /**
   * Índice EN LA LISTA ORIGINAL de la tarea de la que depende, o `null` si
   * abre el espacio. Siempre aparece antes en la lista devuelta, así que el
   * llamador puede crear las filas en este orden y tener ya el id a mano.
   */
  dependeDe: number | null;
}

/**
 * Encadena las tareas de UN espacio en orden constructivo.
 *
 * La lista devuelta está en ORDEN DE CREACIÓN: quien la recorra puede crear
 * cada tarea sabiendo que su predecesor ya existe. El orden es estable —a
 * igual fase manda el orden en que las escribió el usuario— y determinista.
 *
 * @param ordenFase orden constructivo de cada tarea (0 = la que abre la obra),
 *                  en el mismo índice que la lista original de tareas.
 */
export function cadenaDeEspacio(ordenFase: number[]): EslabonCadena[] {
  const indices = ordenFase.map((_, i) => i);
  indices.sort((a, b) => {
    const oa = ordenFase[a];
    const ob = ordenFase[b];
    if (oa !== ob) return oa - ob;
    return a - b; // estable: a igual fase, el orden del usuario
  });
  return indices.map((indice, i) => ({
    indice,
    dependeDe: i === 0 ? null : indices[i - 1],
  }));
}
