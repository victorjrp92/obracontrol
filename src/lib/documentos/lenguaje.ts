import type { TipoDocumentoFirmable } from "@/generated/prisma";

/**
 * El idioma del módulo. Vive aparte porque aquí las palabras son una decisión
 * legal, no de estilo, y conviene poder revisarlas todas de una sentada.
 *
 * Dos reglas gobiernan este archivo:
 *
 *  1. Un informe del profesional se llama SIEMPRE «concepto técnico». Las otras
 *     figuras que se le parecen —las que nombra el Código General del Proceso en
 *     su artículo 226— tienen requisitos que este producto no cumple: quien las
 *     rinde asume deberes procesales, responde por contradicción y debe acreditar
 *     idoneidad ante un juez. Prometerlas sería vender algo que no se entrega.
 *
 *  2. La constancia del cliente dice «recibido conforme» y significa ENTREGA.
 *     No es aprobación del contenido. La diferencia parece cosmética hasta el día
 *     en que alguien recibe un documento, lo discute, y hay que demostrar qué
 *     firmó exactamente. Dos palabras bien elegidas evitan ese pleito.
 */

/**
 * Lo que NUNCA puede aparecer en un texto del módulo.
 *
 * Los términos van partidos a propósito. La compuerta de lenguaje es un `grep`
 * sobre este mismo directorio: si la lista de lo prohibido contuviera lo
 * prohibido escrito de corrido, el propio guardián haría saltar la alarma cada
 * vez. Partido, el literal no existe en el archivo y sí en la comprobación.
 */
export const TERMINOS_PROHIBIDOS: readonly string[] = [
  ["dictamen", "pericial"].join(" "),
  ["prueba", "pericial"].join(" "),
  ["perit", "aje"].join(""),
  ["perit", "o"].join(""),
];

/** El término correcto, el único que este producto puede prometer. */
export const TERMINO_CONCEPTO = "concepto técnico";

/**
 * Cómo se llama cada tipo en pantalla.
 *
 * `INFORME_TECNICO` es el valor que guarda la base —congelado por la migración,
 * no se toca—, pero lo que la gente lee es «Concepto técnico». Los tres tipos de
 * la línea Juntos conservan su propio nombre: son otros documentos, y
 * rebautizarlos sería tan falso como rebautizar este.
 */
export const ETIQUETA_TIPO: Record<TipoDocumentoFirmable, string> = {
  ACTA_ESTADO_INICIAL: "Acta de estado inicial",
  INFORME_TECNICO: "Concepto técnico",
  ACTA_DANOS: "Acta de daños",
  INFORME_GRIETAS: "Informe de grietas",
  DERECHO_PETICION: "Derecho de petición",
};

/**
 * El microcopy del "recibido conforme". Es lo único que el cliente lee antes de
 * dejar su constancia, así que dice sin rodeos lo que la constancia significa y
 * —más importante— lo que NO significa.
 */
export const COPY_RECIBIDO = {
  titulo: "Recibido conforme",
  boton: "Dejar constancia de recibido conforme",
  /** La frase que evita el pleito. Va SIEMPRE junto al botón, nunca escondida. */
  aclaracion:
    "«Recibido conforme» quiere decir que el documento te llegó completo y legible en esta fecha. NO es una aprobación de su contenido: puedes dejar la constancia hoy y no estar de acuerdo con lo que dice.",
  ayuda:
    "Queda registrada la fecha y la hora en que confirmas. Si más adelante discrepas del contenido, esta constancia no te lo impide.",
  hecho: "Constancia de entrega registrada",
} as const;

/** El texto de la firma del profesional, con su alcance legal dicho de frente. */
export const COPY_FIRMA = {
  titulo: "Firmar el documento",
  boton: "Firmar y cerrar el documento",
  /**
   * Ley 527 de 1999 y Decreto 2364 de 2012: una firma electrónica simple vale si
   * se puede probar quién firmó, cuándo, y que el documento no cambió. Eso es lo
   * que hay aquí, y ni una línea más: NO es firma digital certificada, que exige
   * una entidad de certificación.
   */
  alcance:
    "Firma electrónica simple (Ley 527 de 1999). Queda registrado quién firma, la fecha y la hora, y una huella del contenido que permite comprobar después que el documento no cambió. No es firma digital certificada.",
  advertenciaCierre:
    "Al firmar, el documento queda cerrado y ya no se puede modificar. Si hay que corregirlo, se emite una versión nueva con folio nuevo y esta queda como reemplazada.",
  hecho: "Documento firmado y cerrado",
} as const;

/** Aviso de la versión reemplazada, para quien tenga en la mano la anterior. */
export const COPY_VERSION = {
  reemplazado:
    "Este documento fue corregido por una versión posterior. Sigue siendo auténtico y sigue verificando: la versión nueva no lo borra, lo reemplaza.",
  vigente: "Esta es la versión vigente del documento.",
} as const;

/** ¿Este texto usa alguna de las figuras que el producto no puede prometer? */
export function tieneTerminoProhibido(texto: string): string | null {
  const limpio = texto.toLowerCase();
  return TERMINOS_PROHIBIDOS.find((t) => limpio.includes(t)) ?? null;
}
