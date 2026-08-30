import type { DocumentoGuardado } from "./estado";
import { DocumentoError } from "./fallas";

/**
 * La regla que sostiene todo lo demás.
 *
 * La huella SHA-256 solo prueba algo si el documento al que apunta no puede
 * cambiar. Si un documento firmado se pudiera editar —aunque fuera para arreglar
 * una coma— la huella dejaría de significar «esto es lo que se firmó» y pasaría a
 * significar «esto es lo que dice hoy», que no sirve para nada.
 *
 * De ahí que corregir NO sea editar: corregir emite una versión nueva, con folio
 * nuevo y huella nueva, y deja la anterior intacta y verificando. Quien tenga en
 * la mano el papel viejo puede seguir comprobándolo; lo que descubre, además, es
 * que existe una versión posterior.
 *
 * CÓMO SE HACE IMPOSIBLE SALTARSE ESTO, y no solo difícil:
 *
 *  1. El puerto `AlmacenDocumentos` no expone ninguna operación capaz de tocar
 *     el contenido. Sus únicas escrituras son `crear` y las dos transiciones de
 *     firma. No hay un `actualizar()` que alguien pueda llamar por descuido: el
 *     defecto no se evita con disciplina, no existe la función.
 *  2. Las dos transiciones son compare-and-set: la condición viaja en el `where`
 *     de la consulta, no en un `if` del proceso. Dos pestañas firmando a la vez
 *     no producen dos firmas — la segunda cambia cero filas y falla.
 *  3. `scripts/verificar-firmas.ts` comprueba las dos cosas de arriba leyendo el
 *     código, no solo el comportamiento.
 */

/**
 * Lo que jamás cambia una vez escrita la fila. Es una lista declarada a
 * propósito: el script la usa para comprobar que ninguna escritura del módulo
 * toca uno de estos campos.
 */
export const CAMPOS_INMUTABLES = [
  "folio",
  "hash",
  "tipo",
  "proyecto_id",
  "constructora_id",
  "version",
  "reemplaza_a",
  "created_at",
] as const;

/**
 * Lo ÚNICO que una fila ya creada admite que se le escriba, y solo una vez cada
 * cosa: la firma del profesional y la constancia de entrega del cliente.
 */
export const CAMPOS_ESCRIBIBLES_UNA_VEZ = [
  "firmado_por_id",
  "firmado_el",
  "matricula",
  "recibido_por",
  "recibido_el",
] as const;

/** ¿Ya lo firmó el profesional? */
export function estaFirmado(doc: Pick<DocumentoGuardado, "firmado_el">): boolean {
  return doc.firmado_el !== null;
}

/** ¿Ya dejó el cliente su constancia de entrega? */
export function estaRecibido(doc: Pick<DocumentoGuardado, "recibido_el">): boolean {
  return doc.recibido_el !== null;
}

/**
 * Puerta única para cualquier intento de cambiar un documento. Lanza si ya está
 * firmado, y el mensaje dice el camino correcto en vez de limitarse a negar.
 */
export function asegurarModificable(doc: Pick<DocumentoGuardado, "firmado_el">): void {
  if (estaFirmado(doc)) {
    throw new DocumentoError(
      "DOCUMENTO_INMUTABLE",
      "Este documento ya está firmado y no se puede modificar. Para corregirlo se emite una versión nueva con folio nuevo; esta queda como reemplazada y sigue verificando."
    );
  }
}
