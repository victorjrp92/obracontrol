import type { TipoDocumentoFirmable } from "@/generated/prisma";

/**
 * Contratos del módulo de documentos verificables.
 *
 * REGLA DURA DE PRIVACIDAD, y está expresada aquí a propósito: en un registro
 * de documentos NO entra nada que identifique a una persona. Ni nombre, ni
 * cédula, ni dirección, ni teléfono, ni fotos. Lo que se guarda es folio,
 * huella, tipo, ciudad, nivel y número de piezas — con eso se confirma que un
 * documento salió de aquí y se puede agregar el daño por ciudad, que es lo que
 * una alcaldía necesita para el censo, sin identificar a nadie.
 *
 * La cédula y la dirección tienen además una promesa explícita en pantalla de
 * que no se guardan. Si algún día se quisiera guardar más, hace falta un
 * consentimiento aparte con su finalidad y su plazo: no se cuela por aquí.
 *
 * `RegistroDocumento` es la puerta: si un campo personal no existe en este
 * tipo, no hay forma de pedirle al módulo que lo escriba.
 */
export interface RegistroDocumento {
  folio: string;
  /** SHA-256 completo. En el PDF se imprime corto, pero se guarda entero. */
  hash: string;
  tipo: TipoDocumentoFirmable;
  ciudad?: string | null;
  /** Peor nivel del semáforo del documento. Solo aplica a informes de grietas. */
  nivel?: string | null;
  /** Cuántas grietas o espacios trae el documento. */
  piezas?: number | null;
  /** Identificadores de tenant, no de persona. Nulos en la línea Juntos. */
  proyectoId?: string | null;
  constructoraId?: string | null;
}

/**
 * La fila tal cual se escribe en `documentos_firmables`, con los nombres de
 * columna. Es un tipo cerrado a propósito: añadirle un campo obliga a pasar por
 * este archivo y por la regla de privacidad de arriba.
 */
export interface FilaRegistro {
  folio: string;
  hash: string;
  tipo: TipoDocumentoFirmable;
  ciudad: string | null;
  nivel: string | null;
  piezas: number | null;
  proyecto_id: string | null;
  constructora_id: string | null;
}

/**
 * Las dos firmas, tal como las ve QUIEN CONSULTA — que no es necesariamente
 * quien tiene el documento.
 *
 * Fíjate en lo que no hay: ningún nombre. El folio viaja impreso en el pie del
 * PDF y hay que asumir que cualquiera que lo tenga puede consultarlo, así que la
 * respuesta pública dice que hubo firma y cuándo, no quién es la gente.
 *
 * No es una pérdida: los nombres del profesional y de quien recibió están
 * IMPRESOS en el documento y entran en la huella. Si la huella coteja, esos
 * nombres son los que se firmaron; si no coteja, el documento cambió y da igual
 * lo que diga. Publicarlos otra vez aquí no probaría nada más y sí expondría a
 * dos personas ante cualquiera que acierte un folio.
 *
 * La matrícula sí sale: es un número de registro profesional público, va impreso
 * en el documento, y es lo que le permite a una aseguradora comprobar que quien
 * firmó estaba habilitado para hacerlo.
 */
export interface FirmasVerificacion {
  /** Firma del profesional. `AAAA-MM-DD` en la zona de Colombia. */
  profesional: { fecha: string; matricula: string | null } | null;
  /**
   * Constancia de ENTREGA del cliente. Nunca aprobación del contenido: que este
   * campo tenga fecha significa que el documento llegó, no que alguien esté de
   * acuerdo con él.
   */
  recibido: { fecha: string } | null;
}

/**
 * Dónde queda este documento en su cadena de versiones.
 *
 * Se omite cuando es la primera versión y nadie la ha corregido, que es el caso
 * normal. Si aparece con `reemplazado: true`, el documento SIGUE siendo auténtico
 * y sigue verificando: existe una versión posterior que lo corrige.
 */
export interface VigenciaVerificacion {
  version: number;
  reemplazado: boolean;
}

/** Lo mínimo que una fuente devuelve de un documento hallado. */
export interface DocumentoRegistrado {
  tipo: TipoDocumentoFirmable;
  hash: string;
  emitido: Date;
  /** Solo los documentos que llevan firma. Los de la línea Juntos no llevan. */
  firmas?: FirmasVerificacion;
  /** Solo cuando la fuente sabe de versiones. Ausente = primera y vigente. */
  vigencia?: VigenciaVerificacion;
}

/**
 * Respuesta de una fuente de verificación.
 *
 * `indisponible` no es lo mismo que `ausente` y la diferencia importa: si una
 * tabla no responde, decirle a alguien «no encontramos este folio» sería
 * sembrar una duda falsa sobre un documento que puede ser auténtico y que va a
 * presentarle a su aseguradora.
 */
export type Hallazgo =
  | { estado: "encontrado"; documento: DocumentoRegistrado }
  | { estado: "ausente" }
  | { estado: "indisponible" };

/** Un sitio donde buscar un folio. */
export type FuenteVerificacion = (folio: string) => Promise<Hallazgo>;

/**
 * Lo que ve quien consulta. Deliberadamente poco: que el documento existe, de
 * qué tipo es, cuándo se emitió y si la huella coincide. Nada más. Como el
 * folio viaja impreso en el PDF, hay que asumir que cualquiera que lo tenga
 * puede consultarlo: la respuesta no puede revelar nada que el documento no
 * muestre ya.
 */
export type ResultadoVerificacion =
  | { existe: false }
  | { indisponible: true }
  | {
      existe: true;
      tipo: TipoDocumentoFirmable;
      /** `AAAA-MM-DD`. */
      emitido: string;
      /**
       * ¿El contenido cambió? `true` = la huella que trae quien consulta es la
       * del documento guardado. `false` = no lo es, y entonces el papel que
       * tiene en la mano no es el que se emitió. `null` si no mandó huella:
       * «no la mandó» no es lo mismo que «no coincide».
       */
      huellaCoincide: boolean | null;
      /** Ausente en los documentos que no llevan firma. */
      firmas?: FirmasVerificacion;
      /** Ausente cuando es la primera versión y nadie la ha corregido. */
      vigencia?: VigenciaVerificacion;
    };
