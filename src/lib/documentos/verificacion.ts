import { prisma } from "@/lib/prisma";
import { resolverVerificacion } from "./cotejo";
import { esTablaInexistente } from "./errores";
import { hallazgoDeFila } from "./hallazgo";
import { buscarEnDocumentosJuntos } from "./legado-juntos";
import type { FuenteVerificacion, Hallazgo, ResultadoVerificacion } from "./tipos";

/**
 * Los documentos que se emiten hoy.
 *
 * Trae además las dos firmas y la posición en la cadena de versiones, que es lo
 * que permite responder las tres preguntas que de verdad se hacen con un
 * documento en la mano: ¿quién lo firmó y cuándo?, ¿lo recibió el cliente?, y
 * ¿sigue siendo la última versión?
 *
 * Qué se publica de todo eso y qué se calla lo decide `hallazgoDeFila()`, que es
 * puro y está comprobado con casos fijos.
 */
async function buscarEnDocumentosFirmables(folio: string): Promise<Hallazgo> {
  try {
    const doc = await prisma.documentoFirmable.findUnique({
      where: { folio },
      select: {
        tipo: true,
        hash: true,
        created_at: true,
        firmado_el: true,
        matricula: true,
        recibido_el: true,
        version: true,
        // `take: 1` en vez de un `count`: solo importa si hay alguna posterior,
        // y así todo se resuelve en una consulta.
        siguientes: { select: { id: true }, take: 1 },
      },
    });
    if (!doc) return { estado: "ausente" };

    return hallazgoDeFila({ ...doc, reemplazado: doc.siguientes.length > 0 });
  } catch (err) {
    if (esTablaInexistente(err)) return { estado: "indisponible" };
    throw err;
  }
}

/**
 * Dónde se busca un folio, en orden.
 *
 * La segunda fuente es transitoria: existe solo mientras queden documentos sin
 * migrar de la tabla vieja. Cuando se migren, se BORRA esa línea (y el archivo
 * `legado-juntos.ts`) y no hay que tocar nada más.
 */
export const FUENTES_VERIFICACION: readonly FuenteVerificacion[] = [
  buscarEnDocumentosFirmables,
  buscarEnDocumentosJuntos, // LEGADO — borrar cuando los datos estén migrados
];

/**
 * Comprueba un folio y, si se aporta, su huella.
 *
 * Recorre las fuentes en orden y para en cuanto una lo encuentra: en régimen
 * normal un documento nuevo se resuelve con una sola consulta, y solo los
 * anteriores al refactor pagan la segunda.
 */
export async function verificarDocumento(
  folio: string,
  huella?: string | null
): Promise<ResultadoVerificacion> {
  const hallazgos: Hallazgo[] = [];

  for (const buscar of FUENTES_VERIFICACION) {
    const hallazgo = await buscar(folio);
    hallazgos.push(hallazgo);
    if (hallazgo.estado === "encontrado") break;
  }

  return resolverVerificacion(hallazgos, huella);
}
