/**
 * Las fallas del dominio de firmas, con código.
 *
 * El código existe para que las rutas traduzcan a HTTP sin leer mensajes: un
 * `switch` sobre un literal no se rompe cuando alguien mejora la redacción de un
 * texto, y la redacción se va a mejorar, porque estos mensajes los lee gente que
 * está a punto de firmar algo.
 */
export type CodigoFalla =
  /** Se intentó cambiar un documento ya firmado. Se corrige emitiendo otra versión. */
  | "DOCUMENTO_INMUTABLE"
  /** Alguien firmó dos veces, o dos pestañas a la vez. */
  | "YA_FIRMADO"
  /** El profesional aún no subió su imagen de firma. */
  | "SIN_IMAGEN_DE_FIRMA"
  /** El profesional aún no registró su matrícula. */
  | "SIN_MATRICULA"
  /** Se intentó dejar constancia de entrega de un documento que nadie ha firmado. */
  | "NO_FIRMADO"
  /** Ya hay una constancia de entrega; no se pisa. */
  | "YA_RECIBIDO"
  /** Quien recibe no se identificó de forma utilizable. */
  | "RECEPTOR_INVALIDO"
  /** Ya existe una versión posterior: corregir otra vez partiría la cadena en dos. */
  | "VERSION_YA_REEMPLAZADA"
  /** El folio no está bien formado o no es de una familia declarada. */
  | "FOLIO_DESCONOCIDO"
  /** El documento existe, pero no para quien pregunta. */
  | "FUERA_DE_ALCANCE";

export class DocumentoError extends Error {
  constructor(
    public readonly codigo: CodigoFalla,
    mensaje: string
  ) {
    super(mensaje);
    this.name = "DocumentoError";
  }
}

/** ¿Este error es una falla del dominio y no un fallo de infraestructura? */
export function esDocumentoError(err: unknown): err is DocumentoError {
  return err instanceof DocumentoError;
}
