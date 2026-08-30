import { NextResponse } from "next/server";
import { esDocumentoError, type CodigoFalla } from "@/lib/documentos";

/**
 * Traduce una falla del dominio a HTTP.
 *
 * El `switch` va sobre el código, nunca sobre el mensaje: los mensajes los lee
 * gente que está a punto de firmar algo y se van a reescribir muchas veces, y
 * una respuesta HTTP no puede depender de una redacción.
 */
const ESTADO_POR_CODIGO: Record<CodigoFalla, number> = {
  // El documento existe y está en un estado que no admite lo que se pidió.
  DOCUMENTO_INMUTABLE: 409,
  YA_FIRMADO: 409,
  YA_RECIBIDO: 409,
  VERSION_YA_REEMPLAZADA: 409,
  // Falta algo de quien pide.
  SIN_IMAGEN_DE_FIRMA: 400,
  SIN_MATRICULA: 400,
  NO_FIRMADO: 400,
  RECEPTOR_INVALIDO: 400,
  FOLIO_DESCONOCIDO: 400,
  // No existe, o no existe para quien pregunta. Las dos cosas se responden
  // igual: distinguirlas convertiría la ruta en un detector de documentos ajenos.
  FUERA_DE_ALCANCE: 404,
};

/** Respuesta para una falla del dominio, o `null` si el error es otra cosa. */
export function respuestaDeFalla(err: unknown): NextResponse | null {
  if (!esDocumentoError(err)) return null;
  return NextResponse.json(
    { error: err.message, codigo: err.codigo },
    { status: ESTADO_POR_CODIGO[err.codigo] }
  );
}
