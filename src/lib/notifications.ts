import { prisma } from "@/lib/prisma";

type TipoNotificacion =
  | "TAREA_APROBADA"
  | "TAREA_RECHAZADA"
  | "SUGERENCIA_NUEVA"
  | "SUGERENCIA_APROBADA"
  | "SUGERENCIA_RECHAZADA"
  | "OBRERO_REPORTO"
  | "TAREA_REPORTADA";

export async function crearNotificacion(data: {
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  link?: string;
}) {
  return prisma.notificacion.create({ data });
}

/**
 * Devuelve los IDs y emails de usuarios que deben recibir notificaciones
 * supervisoras sobre un proyecto:
 *  - ADMIN_GENERAL y DIRECTIVO de la constructora (todos los proyectos)
 *  - ADMIN_PROYECTO que tenga acceso explícito a este proyecto
 *
 * Filtra fuera al usuario `excludeUserId` (típicamente el reporter mismo)
 * para no auto-notificarse.
 */
export async function getProjectSupervisors(
  proyectoId: string,
  constructoraId: string,
  excludeUserId?: string,
): Promise<{ id: string; email: string }[]> {
  const supers = await prisma.usuario.findMany({
    where: {
      constructora_id: constructoraId,
      OR: [
        {
          rol_ref: { nivel_acceso: { in: ["ADMIN_GENERAL", "DIRECTIVO"] } },
        },
        {
          rol_ref: { nivel_acceso: "ADMIN_PROYECTO" },
          proyectos_administrados: { some: { proyecto_id: proyectoId } },
        },
      ],
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, email: true },
  });
  return supers;
}
