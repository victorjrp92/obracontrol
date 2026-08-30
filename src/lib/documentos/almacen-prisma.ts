import { prisma } from "@/lib/prisma";
import type { AlmacenDocumentos } from "./almacen";
import type { DatosFirma, DatosRecibido, DocumentoGuardado, DocumentoNuevo } from "./estado";
import { construirFilaRegistro } from "./fila-registro";

/**
 * El puerto, contra Postgres.
 *
 * Dos cosas que hay que mirar aquí y no en otra parte:
 *
 *  1. Las dos escrituras de transición son `updateMany` con la condición en el
 *     `where`, y su `data` solo contiene campos de firma. Ni una de ellas puede
 *     tocar folio, huella, tipo, versión ni tenant: no aparecen. Es la traducción
 *     literal de la regla de inmutabilidad a SQL.
 *  2. La creación pasa por `construirFilaRegistro`, que es el guardián de
 *     privacidad del módulo: enumera campo por campo lo que se escribe y no hace
 *     spread de la entrada, así que por aquí no se cuela un dato personal aunque
 *     el llamador traiga el objeto entero pegado. Lo único que se le añade es la
 *     versión y a quién reemplaza.
 */

/** Lo que se lee siempre de una fila. Cerrado: si no está aquí, no sale de la base. */
const CAMPOS = {
  id: true,
  folio: true,
  hash: true,
  tipo: true,
  proyecto_id: true,
  constructora_id: true,
  firmado_por_id: true,
  firmado_el: true,
  matricula: true,
  recibido_por: true,
  recibido_el: true,
  version: true,
  reemplaza_a: true,
  created_at: true,
} as const;

export const almacenPrisma: AlmacenDocumentos = {
  async porId(id: string): Promise<DocumentoGuardado | null> {
    return prisma.documentoFirmable.findUnique({ where: { id }, select: CAMPOS });
  },

  async porFolio(folio: string): Promise<DocumentoGuardado | null> {
    return prisma.documentoFirmable.findUnique({ where: { folio }, select: CAMPOS });
  },

  async fueReemplazado(id: string): Promise<boolean> {
    const posteriores = await prisma.documentoFirmable.count({ where: { reemplaza_a: id } });
    return posteriores > 0;
  },

  async reemplazados(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const posteriores = await prisma.documentoFirmable.findMany({
      where: { reemplaza_a: { in: [...ids] } },
      select: { reemplaza_a: true },
    });
    return new Set(posteriores.map((p) => p.reemplaza_a).filter((id): id is string => id !== null));
  },

  async firmadosDelProyecto(proyectoId: string): Promise<DocumentoGuardado[]> {
    return prisma.documentoFirmable.findMany({
      where: { proyecto_id: proyectoId, firmado_el: { not: null } },
      orderBy: { created_at: "desc" },
      select: CAMPOS,
    });
  },

  async crear(nuevo: DocumentoNuevo): Promise<DocumentoGuardado> {
    const fila = construirFilaRegistro({
      folio: nuevo.folio,
      hash: nuevo.hash,
      tipo: nuevo.tipo,
      ciudad: nuevo.ciudad,
      nivel: nuevo.nivel,
      piezas: nuevo.piezas,
      proyectoId: nuevo.proyecto_id,
      constructoraId: nuevo.constructora_id,
    });

    return prisma.documentoFirmable.create({
      data: { ...fila, version: nuevo.version, reemplaza_a: nuevo.reemplaza_a },
      select: CAMPOS,
    });
  },

  async firmarSiSigueSinFirmar(id: string, datos: DatosFirma): Promise<number> {
    const res = await prisma.documentoFirmable.updateMany({
      where: { id, firmado_el: null },
      data: {
        firmado_por_id: datos.firmado_por_id,
        firmado_el: datos.firmado_el,
        matricula: datos.matricula,
      },
    });
    return res.count;
  },

  async recibirSiFirmadoYSinRecibir(id: string, datos: DatosRecibido): Promise<number> {
    const res = await prisma.documentoFirmable.updateMany({
      where: { id, firmado_el: { not: null }, recibido_el: null },
      data: { recibido_por: datos.recibido_por, recibido_el: datos.recibido_el },
    });
    return res.count;
  },
};
