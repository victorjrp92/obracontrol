import type { TipoDocumentoFirmable, TipoDocumentoJuntos } from "@/generated/prisma";
import {
  registrarDocumento as registrarDocumentoVerificable,
  verificarDocumento as verificarDocumentoVerificable,
} from "@/lib/documentos";

/**
 * Registro de verificación de los documentos de «Juntos».
 *
 * Capa fina sobre `@/lib/documentos`, que es donde vive de verdad el folio, la
 * huella, el registro y la consulta. Aquí solo queda lo que es propio de esta
 * línea: cómo llama Juntos a sus tres documentos. La API pública de este
 * archivo no cambió — sus llamadores (las rutas de PDF y la de verificación)
 * siguen hablando en `TipoDocumentoJuntos` sin enterarse del cambio.
 *
 * La regla dura sigue siendo la misma y ahora la impone el módulo compartido:
 * aquí NO entra nada que identifique a una persona. Ni nombre, ni cédula, ni
 * dirección, ni teléfono, ni fotos. Solo folio, huella, tipo, ciudad, nivel y
 * número de piezas.
 *
 * El registro es BEST-EFFORT: si falla, el documento se entrega igual.
 */

/**
 * Cómo se llama cada documento de Juntos en el registro compartido.
 * Exportado para que `scripts/verificar-documentos.ts` pueda congelarlo: si
 * alguien cambia una correspondencia, deja de verificar todo lo ya emitido.
 */
export const TIPO_FIRMABLE: Record<TipoDocumentoJuntos, TipoDocumentoFirmable> = {
  ACTA: "ACTA_DANOS",
  INFORME: "INFORME_GRIETAS",
  PETICION: "DERECHO_PETICION",
};

/**
 * La vuelta. Es parcial a propósito: el registro compartido también guarda
 * documentos de otras líneas, y esta pantalla no debe responder por ellos.
 */
export const TIPO_JUNTOS: Partial<Record<TipoDocumentoFirmable, TipoDocumentoJuntos>> = {
  ACTA_DANOS: "ACTA",
  INFORME_GRIETAS: "INFORME",
  DERECHO_PETICION: "PETICION",
};

export interface RegistroDocumento {
  folio: string;
  /** SHA-256 completo. En el PDF se imprime corto, pero se guarda entero. */
  hash: string;
  tipo: TipoDocumentoJuntos;
  ciudad?: string | null;
  /** Peor nivel del semáforo. Solo aplica a informes de grietas. */
  nivel?: string | null;
  /** Cuántas grietas o espacios trae el documento. */
  piezas?: number | null;
}

/**
 * Deja constancia de un documento emitido. Nunca lanza: quien la llama ya
 * generó el PDF y debe entregarlo pase lo que pase.
 */
export async function registrarDocumento(datos: RegistroDocumento): Promise<void> {
  await registrarDocumentoVerificable({
    folio: datos.folio,
    hash: datos.hash,
    tipo: TIPO_FIRMABLE[datos.tipo],
    ciudad: datos.ciudad,
    nivel: datos.nivel,
    piezas: datos.piezas,
  });
}

export type ResultadoVerificacion =
  | { existe: false }
  | { indisponible: true }
  | {
      existe: true;
      tipo: TipoDocumentoJuntos;
      emitido: string;
      /** `null` si quien consulta no mandó huella para cotejar. */
      huellaCoincide: boolean | null;
    };

/**
 * Comprueba un folio de Juntos y, si se aporta, su huella.
 *
 * Devuelve DELIBERADAMENTE poco: que el documento existe, de qué tipo es,
 * cuándo se emitió y si la huella coincide. Nada más. Quien consulta suele ser
 * una aseguradora con el PDF en la mano y le basta con saber que es auténtico —
 * no necesita, ni debe recibir, el contenido.
 *
 * Bajo el capó se buscan tanto los documentos nuevos como los emitidos antes de
 * que esto se sacara a un módulo común: un acta descargada la semana pasada
 * sigue verificando igual.
 */
export async function verificarDocumento(
  folio: string,
  huella?: string | null
): Promise<ResultadoVerificacion> {
  const resultado = await verificarDocumentoVerificable(folio, huella);

  if ("indisponible" in resultado) return resultado;
  if (!resultado.existe) return { existe: false };

  const tipo = TIPO_JUNTOS[resultado.tipo];
  // Un documento de otra línea no es un documento de Juntos: para esta pantalla
  // no existe. Traducirlo a un tipo de Juntos sería mentir sobre su origen, y
  // devolverlo tal cual filtraría a esta consulta pública documentos de un
  // producto que no le corresponde.
  if (!tipo) return { existe: false };

  return {
    existe: true,
    tipo,
    emitido: resultado.emitido,
    huellaCoincide: resultado.huellaCoincide,
  };
}
