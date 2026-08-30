import type { DatosRecibido, DocumentoGuardado } from "./estado";
import { DocumentoError } from "./fallas";
import { estaFirmado, estaRecibido } from "./inmutabilidad";

/**
 * El «recibido conforme» del cliente.
 *
 * Es una CONSTANCIA DE ENTREGA. Prueba que el documento le llegó a alguien, en
 * una fecha, completo y legible. No prueba —ni pretende probar— que esa persona
 * esté de acuerdo con lo que el documento dice.
 *
 * La distinción se sostiene en dos palabras, y por eso están elegidas así:
 * «recibido» es un hecho comprobable; «conforme» califica la recepción, no el
 * contenido. El microcopy que acompaña al botón (`COPY_RECIBIDO` en
 * `lenguaje.ts`) lo dice sin rodeos, porque una persona que confirma sin
 * entender qué confirma es exactamente el problema que esto evita.
 *
 * Quien recibe NO tiene cuenta: entra por el enlace del cliente, el mismo
 * mecanismo de `/c/[token]` que ya existía. Su identidad, entonces, es lo que
 * escribe. Es más débil que la del profesional y no se disimula: por eso esto es
 * constancia de entrega y no una segunda firma con el mismo peso.
 */

export const RECEPTOR_LARGO_MIN = 3;
export const RECEPTOR_LARGO_MAX = 80;

/**
 * Deja la identificación de quien recibe como se va a guardar. `null` si no
 * sirve: sin alguien identificado, la constancia no dice nada.
 */
export function normalizarReceptor(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.trim().replace(/\s+/g, " ").slice(0, RECEPTOR_LARGO_MAX);
  return limpio.length >= RECEPTOR_LARGO_MIN ? limpio : null;
}

/**
 * Calcula la constancia de entrega, o lanza diciendo por qué no procede.
 *
 * Solo se puede recibir un documento FIRMADO: mientras el profesional no lo
 * haya cerrado, lo que existe es un borrador, y dejar constancia de haber
 * recibido un borrador no significaría nada. Y solo una vez: la primera
 * constancia es la buena, y pisarla sería reescribir una fecha que ya se dio por
 * cierta.
 */
export function planificarRecibido(
  doc: Pick<DocumentoGuardado, "firmado_el" | "recibido_el">,
  receptorCrudo: string | null | undefined,
  ahora: Date = new Date()
): DatosRecibido {
  if (!estaFirmado(doc)) {
    throw new DocumentoError(
      "NO_FIRMADO",
      "Este documento todavía no está firmado, así que aún no se puede dejar constancia de entrega."
    );
  }

  if (estaRecibido(doc)) {
    throw new DocumentoError("YA_RECIBIDO", "Este documento ya tiene su constancia de entrega.");
  }

  const receptor = normalizarReceptor(receptorCrudo);
  if (!receptor) {
    throw new DocumentoError(
      "RECEPTOR_INVALIDO",
      `Escribe quién recibe el documento (entre ${RECEPTOR_LARGO_MIN} y ${RECEPTOR_LARGO_MAX} caracteres).`
    );
  }

  return { recibido_por: receptor, recibido_el: ahora };
}
