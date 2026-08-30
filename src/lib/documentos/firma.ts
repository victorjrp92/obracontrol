import type { DatosFirma, DocumentoGuardado } from "./estado";
import { DocumentoError } from "./fallas";
import { estaFirmado } from "./inmutabilidad";
import { normalizarMatricula, type PerfilFirma } from "./perfil-firma";

/**
 * La firma del profesional.
 *
 * Ley 527 de 1999 y Decreto 2364 de 2012: una firma electrónica simple vale si
 * se puede probar QUIÉN firmó, CUÁNDO, y que el documento NO CAMBIÓ. La huella
 * SHA-256 cubre lo tercero. Los otros dos salen de aquí:
 *
 *   QUIÉN  — la sesión autenticada. No hay un campo «escriba su nombre»: el
 *            identificador que se estampa es el del usuario que tiene la sesión
 *            abierta, y esa sesión pasó por Supabase Auth. Un campo de texto
 *            libre no probaría nada; cualquiera escribiría cualquier cosa.
 *   CUÁNDO — el instante del servidor, no uno que venga en la petición. El reloj
 *            del navegador lo mueve quien quiera.
 *
 * Y la MATRÍCULA se congela: se copia del perfil a la fila del documento en el
 * momento de firmar. Si el profesional la actualiza después, el documento ya
 * emitido no cambia — no puede cambiar, porque nada del módulo sabe reescribir
 * una fila firmada. Eso importa: la matrícula impresa en un papel que ya está en
 * manos de un cliente tiene que seguir siendo la que se imprimió.
 *
 * Esto NO es firma digital certificada. Esa exige una entidad de certificación
 * acreditada y aquí no la hay. El texto de pantalla lo dice con esas palabras.
 */

/** Quién firma: la sesión, y lo que tiene guardado en su perfil. */
export interface Firmante {
  /** Id del usuario de la SESIÓN autenticada. No llega por el cuerpo de la petición. */
  usuarioId: string;
  perfil: PerfilFirma;
}

/**
 * Calcula lo que se estampa al firmar, o lanza diciendo qué falta.
 *
 * Función pura: no escribe. Quien escribe es el almacén, y lo hace con una
 * condición en el `where` que vuelve a comprobar que el documento sigue sin
 * firmar. Esta comprobación de aquí es para dar un mensaje útil; la que impide
 * la doble firma es aquella.
 */
export function planificarFirma(
  doc: Pick<DocumentoGuardado, "firmado_el">,
  firmante: Firmante,
  ahora: Date = new Date()
): DatosFirma {
  if (estaFirmado(doc)) {
    throw new DocumentoError("YA_FIRMADO", "Este documento ya está firmado.");
  }

  if (!firmante.perfil.imagenPath) {
    throw new DocumentoError(
      "SIN_IMAGEN_DE_FIRMA",
      "Antes de firmar hay que subir la imagen de la firma. Se sube una vez y queda en el perfil."
    );
  }

  const matricula = normalizarMatricula(firmante.perfil.matricula);
  if (!matricula) {
    throw new DocumentoError(
      "SIN_MATRICULA",
      "Antes de firmar hay que registrar la matrícula profesional: queda impresa en el documento y se congela al firmar."
    );
  }

  return {
    firmado_por_id: firmante.usuarioId,
    firmado_el: ahora,
    matricula,
  };
}
