import { prisma } from "@/lib/prisma";

type TipoNotificacion =
  | "TAREA_APROBADA"
  | "TAREA_RECHAZADA"
  | "SUGERENCIA_NUEVA"
  | "SUGERENCIA_APROBADA"
  | "SUGERENCIA_RECHAZADA"
  | "OBRERO_REPORTO";

export async function crearNotificacion(data: {
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  link?: string;
}) {
  return prisma.notificacion.create({ data });
}
