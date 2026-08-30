import type { AlmacenDocumentos } from "./almacen";
import { almacenPrisma } from "./almacen-prisma";
import type { DocumentoGuardado } from "./estado";
import { DocumentoError } from "./fallas";
import { planificarFirma, type Firmante } from "./firma";
import { asegurarModificable } from "./inmutabilidad";
import { planificarRecibido } from "./recibido";
import {
  planificarCorreccion,
  planificarEmision,
  type DatosCorreccion,
  type DatosEmision,
} from "./versiones";
import { asegurarEnAlcance, vistaCliente, type DocumentoParaCliente } from "./vista-cliente";

/**
 * Los casos de uso: emitir, firmar, corregir y dejar constancia de entrega.
 *
 * Todo pasa por un `AlmacenDocumentos` inyectable. En producción es el de
 * Prisma; en `scripts/verificar-firmas.ts` es uno en memoria que reproduce las
 * mismas condiciones de escritura. Así las reglas se comprueban de verdad —la
 * carrera de la doble firma incluida— sin levantar una base.
 *
 * Un detalle que no es de estilo: cuando una transición cambia CERO filas, aquí
 * no se reintenta ni se fuerza. Cero significa que otro llegó antes y que el
 * estado del documento ya no es el que se leyó, así que se relee y se lanza la
 * falla que corresponda. Reintentar sería justamente la forma de producir la
 * segunda firma que la condición acaba de impedir.
 */

/**
 * Deja constancia de un documento recién emitido.
 *
 * A diferencia de `registrarDocumento()` —que es best-effort porque la línea
 * Juntos entrega el PDF pase lo que pase— este SÍ lanza si falla. Un documento
 * firmable sin fila no se puede firmar, ni verificar, ni corregir: entregarlo
 * sería entregar un papel que dice «Verificación: …» y no verifica.
 */
export async function emitirDocumento(
  datos: DatosEmision,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoGuardado> {
  return almacen.crear(planificarEmision(datos));
}

/**
 * Firma del profesional. La identidad es la sesión: `firmante.usuarioId` viene
 * de `requireUser()`, nunca del cuerpo de la petición.
 */
export async function firmarDocumento(
  id: string,
  firmante: Firmante,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoGuardado> {
  const doc = await almacen.porId(id);
  if (!doc) {
    throw new DocumentoError("FUERA_DE_ALCANCE", "Documento no encontrado.");
  }

  const datos = planificarFirma(doc, firmante);
  const filas = await almacen.firmarSiSigueSinFirmar(id, datos);

  if (filas === 0) {
    throw new DocumentoError(
      "YA_FIRMADO",
      "Este documento se firmó mientras tanto. Recarga para ver la firma."
    );
  }

  return (await almacen.porId(id)) as DocumentoGuardado;
}

/**
 * Corrige un documento emitiendo una versión NUEVA. La anterior no se toca: se
 * queda como está, con su folio y su huella, y sigue verificando.
 */
export async function emitirCorreccion(
  anteriorId: string,
  datos: Omit<DatosCorreccion, "yaReemplazado">,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoGuardado> {
  const anterior = await almacen.porId(anteriorId);
  if (!anterior) {
    throw new DocumentoError("FUERA_DE_ALCANCE", "Documento no encontrado.");
  }

  const yaReemplazado = await almacen.fueReemplazado(anteriorId);
  return almacen.crear(planificarCorreccion(anterior, { ...datos, yaReemplazado }));
}

/**
 * Permiso para tocar el contenido de un documento.
 *
 * Lo llama quien guarde ese contenido por su cuenta —el generador del PDF, por
 * ejemplo— ANTES de reescribirlo. Si el documento ya está firmado, lanza y dice
 * el camino correcto, que es emitir una corrección.
 */
export async function asegurarBorrador(
  id: string,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoGuardado> {
  const doc = await almacen.porId(id);
  if (!doc) {
    throw new DocumentoError("FUERA_DE_ALCANCE", "Documento no encontrado.");
  }
  asegurarModificable(doc);
  return doc;
}

/**
 * «Recibido conforme» del cliente, por su enlace sin cuenta.
 *
 * `proyectoId` sale del token —nunca de la URL ni del cuerpo— y acota TODO lo
 * que sigue: un folio de otra obra, o de otro tenant, no llega a compararse
 * siquiera. Es el mismo aislamiento por construcción de `/c/[token]`.
 */
export async function dejarConstanciaDeRecibido(
  folio: string,
  proyectoId: string,
  receptorCrudo: string | null | undefined,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoParaCliente> {
  const doc = asegurarEnAlcance(await almacen.porFolio(folio), proyectoId);

  const datos = planificarRecibido(doc, receptorCrudo);
  const filas = await almacen.recibirSiFirmadoYSinRecibir(doc.id, datos);

  if (filas === 0) {
    throw new DocumentoError(
      "YA_RECIBIDO",
      "Este documento ya tiene su constancia de entrega. Recarga para verla."
    );
  }

  return documentoParaCliente(folio, proyectoId, almacen);
}

/** Un documento visto desde el enlace del cliente, ya proyectado. */
export async function documentoParaCliente(
  folio: string,
  proyectoId: string,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoParaCliente> {
  const doc = asegurarEnAlcance(await almacen.porFolio(folio), proyectoId);
  return vistaCliente(doc, await almacen.fueReemplazado(doc.id));
}

/** Los documentos ya firmados de la obra del enlace. Los borradores no salen. */
export async function documentosDelCliente(
  proyectoId: string,
  almacen: AlmacenDocumentos = almacenPrisma
): Promise<DocumentoParaCliente[]> {
  const docs = await almacen.firmadosDelProyecto(proyectoId);
  const reemplazados = await almacen.reemplazados(docs.map((d) => d.id));
  return docs.map((d) => vistaCliente(d, reemplazados.has(d.id)));
}
