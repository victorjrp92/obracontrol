import type { TipoDocumentoFirmable } from "@/generated/prisma";
import type { DocumentoGuardado, DocumentoNuevo } from "./estado";
import { DocumentoError } from "./fallas";
import { generarFolio, hashContenido, prefijoDeFolio, type PrefijoFolio } from "./folio";

/**
 * Emisión y corrección: cómo nace un documento y cómo nace su corrección.
 *
 * Corregir NO es editar. Un documento firmado no se toca nunca; lo que se hace es
 * emitir una versión nueva —folio nuevo, huella nueva, `version` una más arriba—
 * que apunta a la anterior con `reemplaza_a`. La anterior queda tal cual estaba,
 * y por eso sigue verificando: quien tenga ese papel en la mano comprueba su
 * folio y su huella igual que el primer día, y de paso se entera de que existe
 * una versión posterior.
 *
 * La marca de «reemplazada» no es una columna que alguien deba acordarse de
 * poner. Es el propio `reemplaza_a` de la versión nueva, leído al revés: un
 * documento está reemplazado si alguien lo señala. Un estado derivado no se puede
 * desincronizar del hecho que lo produce.
 *
 * Todo lo de este archivo es puro. No consulta ni escribe.
 */

/**
 * Qué prefijo de folio lleva cada tipo de documento.
 *
 * `INFORME_TECNICO` es el valor congelado en la base; en el folio, en la
 * pantalla y en el pie del PDF el documento se llama concepto técnico, y por eso
 * su prefijo es `CT`.
 */
export const PREFIJO_POR_TIPO: Record<TipoDocumentoFirmable, PrefijoFolio> = {
  COTIZACION: "CZ",
  ACTA_ESTADO_INICIAL: "AE",
  INFORME_TECNICO: "CT",
  ACTA_DANOS: "JT",
  INFORME_GRIETAS: "JT",
  DERECHO_PETICION: "DP",
};

/** Lo que hace falta para emitir. `contenido` es lo que se imprime, serializado. */
export interface DatosEmision {
  tipo: TipoDocumentoFirmable;
  /**
   * El contenido validado, serializado EXACTAMENTE como se imprime. Es lo que
   * entra en la huella: si cambia un byte, la huella cambia, y el documento
   * impreso deja de cotejar. Por eso quien emite y quien imprime tienen que
   * serializar lo mismo.
   */
  contenido: string;
  proyectoId?: string | null;
  constructoraId?: string | null;
  ciudad?: string | null;
  nivel?: string | null;
  piezas?: number | null;
}

/** La primera versión de un documento: `version` 1 y sin nada a que reemplazar. */
export function planificarEmision(datos: DatosEmision, ahora: Date = new Date()): DocumentoNuevo {
  const folio = generarFolio(PREFIJO_POR_TIPO[datos.tipo], ahora);
  return {
    folio,
    hash: hashContenido(datos.contenido, folio),
    tipo: datos.tipo,
    proyecto_id: datos.proyectoId ?? null,
    constructora_id: datos.constructoraId ?? null,
    ciudad: datos.ciudad ?? null,
    nivel: datos.nivel ?? null,
    piezas: datos.piezas ?? null,
    version: 1,
    reemplaza_a: null,
  };
}

/** Lo que cambia en una corrección: el contenido y, si aplica, los agregados. */
export interface DatosCorreccion {
  contenido: string;
  ciudad?: string | null;
  nivel?: string | null;
  piezas?: number | null;
  /**
   * ¿La versión que se quiere corregir ya tiene una posterior? Lo resuelve quien
   * consulta, porque es un hecho de la base; la regla de qué hacer con él vive
   * aquí. Corregir dos veces la misma versión partiría la cadena en dos ramas y
   * ya no habría una «versión vigente», sino dos.
   */
  yaReemplazado: boolean;
}

/**
 * La corrección de un documento: versión nueva, folio nuevo, huella nueva.
 *
 * Conserva la familia del folio anterior —una corrección de un acta de estado
 * inicial sigue siendo un acta de estado inicial— y la lee del folio que el
 * documento ya tiene impreso, que es la única fuente que no puede mentir.
 *
 * No exige que la anterior esté firmada: si no lo está, corregirla igual emite
 * una versión nueva. Es más trabajo del estrictamente necesario y es a propósito
 * — que exista UN solo camino para cambiar un documento es justo lo que hace
 * imposible saltarse la inmutabilidad por descuido.
 */
export function planificarCorreccion(
  anterior: DocumentoGuardado,
  datos: DatosCorreccion,
  ahora: Date = new Date()
): DocumentoNuevo {
  if (datos.yaReemplazado) {
    throw new DocumentoError(
      "VERSION_YA_REEMPLAZADA",
      "Esta versión ya fue corregida por una posterior. Corrige la versión vigente."
    );
  }

  const prefijo = prefijoDeFolio(anterior.folio);
  if (!prefijo) {
    throw new DocumentoError(
      "FOLIO_DESCONOCIDO",
      "El folio del documento anterior no es de una familia conocida; no se puede emitir su corrección."
    );
  }

  const folio = generarFolio(prefijo, ahora);
  return {
    folio,
    hash: hashContenido(datos.contenido, folio),
    tipo: anterior.tipo,
    proyecto_id: anterior.proyecto_id,
    constructora_id: anterior.constructora_id,
    ciudad: datos.ciudad ?? null,
    nivel: datos.nivel ?? null,
    piezas: datos.piezas ?? null,
    version: anterior.version + 1,
    reemplaza_a: anterior.id,
  };
}
