import type { TipoDocumentoFirmable, TipoDocumentoJuntos } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { esTablaInexistente } from "./errores";
import type { Hallazgo } from "./tipos";

/**
 * LEGADO — este archivo tiene fecha de caducidad.
 *
 * Antes de que el folio y la huella fueran un servicio compartido, los
 * documentos de la línea Juntos se registraban en la tabla `documentos_juntos`.
 * Hay actas, informes y derechos de petición YA EMITIDOS Y DESCARGADOS que solo
 * existen ahí, con su folio impreso en un PDF que hoy está en manos de una
 * persona o de su aseguradora. Mientras esas filas no se migren, la
 * verificación tiene que seguir mirando aquí o esos papeles dejarían de
 * comprobar de un día para otro.
 *
 * CÓMO SE RETIRA: cuando las filas estén migradas a `documentos_firmables`,
 * basta con borrar este archivo y su línea en `FUENTES_VERIFICACION`. Nada más
 * del módulo cambia — por eso la búsqueda está escrita como una fuente más y no
 * incrustada en la consulta.
 */

/**
 * Cómo se llamaba cada tipo en la tabla vieja. Duplica a propósito el mapa que
 * la línea Juntos tiene en su lado: aquel dice cómo nombra ella sus documentos
 * hoy, este dice cómo hay que LEER filas viejas. Son dos cosas distintas que
 * casualmente coinciden, y unirlas ataría este módulo a un consumidor.
 */
export const TIPO_LEGADO: Record<TipoDocumentoJuntos, TipoDocumentoFirmable> = {
  ACTA: "ACTA_DANOS",
  INFORME: "INFORME_GRIETAS",
  PETICION: "DERECHO_PETICION",
};

export async function buscarEnDocumentosJuntos(folio: string): Promise<Hallazgo> {
  try {
    const doc = await prisma.documentoJuntos.findUnique({
      where: { folio },
      select: { tipo: true, hash: true, created_at: true },
    });
    if (!doc) return { estado: "ausente" };
    return {
      estado: "encontrado",
      documento: { tipo: TIPO_LEGADO[doc.tipo], hash: doc.hash, emitido: doc.created_at },
    };
  } catch (err) {
    if (esTablaInexistente(err)) return { estado: "indisponible" };
    throw err;
  }
}
