import type { TipoDocumentoFirmable } from "@/generated/prisma";
import type { DocumentoGuardado } from "./estado";
import { DocumentoError } from "./fallas";
import { fechaEnColombia, momentoEnColombia } from "./fechas";
import { hashCorto } from "./folio";
import { ETIQUETA_TIPO } from "./lenguaje";

/**
 * Lo que ve el cliente por su enlace, y nada más.
 *
 * El enlace del cliente es una credencial completa: quien lo tenga, entra. Así
 * que la vista se construye por proyección explícita, campo por campo, y nunca
 * devolviendo la fila. La diferencia no es de estilo: una fila devuelta entera
 * arrastra `proyecto_id`, `constructora_id` y el id del profesional que firmó, y
 * ninguno de los tres tiene por qué salir de la casa.
 *
 * El aislamiento por obra tampoco se comprueba a mano en cada ruta: el token
 * resuelve a UN proyecto y `asegurarEnAlcance()` es el único camino para llegar a
 * un documento desde ahí. Un documento de otra obra —o de otro tenant— no
 * responde distinto de uno que no existe: la misma falla, el mismo texto. Si
 * respondiera distinto, el enlace serviría para averiguar qué folios existen.
 */

export interface DocumentoParaCliente {
  folio: string;
  tipo: TipoDocumentoFirmable;
  /** Cómo se llama en pantalla. `INFORME_TECNICO` se lee «Concepto técnico». */
  etiqueta: string;
  /** Los 12 hex del pie del PDF, para que pueda cotejar lo que tiene impreso. */
  huellaCorta: string;
  /** `AAAA-MM-DD`. */
  emitido: string;
  firmadoEl: string | null;
  /** Fecha y hora legibles de la firma, en la zona de Colombia. */
  firmadoMomento: string | null;
  /** La matrícula que estaba vigente cuando se firmó, no la de hoy. */
  matricula: string | null;
  recibidoEl: string | null;
  recibidoMomento: string | null;
  /** Quién dejó la constancia de entrega, tal como la escribió. */
  recibidoPor: string | null;
  version: number;
  /** ¿Existe una versión posterior que corrige a esta? */
  reemplazado: boolean;
}

/** ¿Este documento pertenece a la obra a la que apunta el enlace? */
export function esDelProyecto(
  doc: Pick<DocumentoGuardado, "proyecto_id">,
  proyectoId: string
): boolean {
  return doc.proyecto_id !== null && doc.proyecto_id === proyectoId;
}

/**
 * Único camino desde un enlace de cliente hasta un documento.
 *
 * «No existe» y «existe pero no es tuyo» lanzan exactamente lo mismo, a
 * propósito: dos respuestas distintas convertirían el enlace en un detector de
 * folios ajenos.
 */
export function asegurarEnAlcance(
  doc: DocumentoGuardado | null,
  proyectoId: string
): DocumentoGuardado {
  if (!doc || !esDelProyecto(doc, proyectoId)) {
    throw new DocumentoError("FUERA_DE_ALCANCE", "Este documento no está disponible por este enlace.");
  }
  return doc;
}

/** La proyección. Campo por campo, nunca la fila entera. */
export function vistaCliente(doc: DocumentoGuardado, reemplazado: boolean): DocumentoParaCliente {
  return {
    folio: doc.folio,
    tipo: doc.tipo,
    etiqueta: ETIQUETA_TIPO[doc.tipo],
    huellaCorta: hashCorto(doc.hash),
    emitido: fechaEnColombia(doc.created_at),
    firmadoEl: doc.firmado_el ? fechaEnColombia(doc.firmado_el) : null,
    firmadoMomento: doc.firmado_el ? momentoEnColombia(doc.firmado_el) : null,
    matricula: doc.matricula,
    recibidoEl: doc.recibido_el ? fechaEnColombia(doc.recibido_el) : null,
    recibidoMomento: doc.recibido_el ? momentoEnColombia(doc.recibido_el) : null,
    recibidoPor: doc.recibido_por,
    version: doc.version,
    reemplazado,
  };
}
