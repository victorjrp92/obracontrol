import type { DatosFirma, DatosRecibido, DocumentoGuardado, DocumentoNuevo } from "./estado";

/**
 * El puerto por donde el módulo toca la base. Es corto a propósito.
 *
 * MIRA LO QUE NO HAY: no hay `actualizar()`, no hay `borrar()`, no hay `upsert()`.
 * Las únicas escrituras que este puerto sabe expresar son crear una fila y las
 * dos transiciones de firma. Un llamador que quisiera cambiar el contenido de un
 * documento firmado no tiene con qué: no es que esté prohibido, es que no existe
 * la operación. Esa es la forma fuerte de la inmutabilidad — la débil sería un
 * `if` que alguien puede olvidar.
 *
 * Las dos transiciones devuelven CUÁNTAS FILAS cambiaron en vez de la fila
 * resultante, y eso también es deliberado: la condición («sigue sin firmar»,
 * «está firmado y sin recibir») viaja dentro de la consulta, así que la carrera
 * entre dos pestañas la resuelve la base y no el proceso. Un `0` significa «otro
 * llegó antes», y quien llama tiene que tratarlo.
 *
 * Tener puerto, además, es lo que permite comprobar todas las reglas sin base de
 * datos: `scripts/verificar-firmas.ts` inyecta un almacén en memoria que
 * reproduce estas mismas condiciones.
 */
export interface AlmacenDocumentos {
  porId(id: string): Promise<DocumentoGuardado | null>;
  porFolio(folio: string): Promise<DocumentoGuardado | null>;

  /** ¿Alguna versión posterior señala a esta? Así se sabe si está reemplazada. */
  fueReemplazado(id: string): Promise<boolean>;

  /**
   * Lo mismo para una lista, en una sola consulta. La lista del cliente es una
   * pantalla pública: preguntar documento por documento serían N consultas por
   * visita, y no hay razón para pagarlas.
   */
  reemplazados(ids: readonly string[]): Promise<Set<string>>;

  /** Documentos ya firmados de una obra, del más reciente al más antiguo. */
  firmadosDelProyecto(proyectoId: string): Promise<DocumentoGuardado[]>;

  crear(nuevo: DocumentoNuevo): Promise<DocumentoGuardado>;

  /** Compare-and-set. `1` si firmó; `0` si ya estaba firmado cuando llegó. */
  firmarSiSigueSinFirmar(id: string, datos: DatosFirma): Promise<number>;

  /** Compare-and-set. `1` si dejó la constancia; `0` si ya no procedía. */
  recibirSiFirmadoYSinRecibir(id: string, datos: DatosRecibido): Promise<number>;
}
