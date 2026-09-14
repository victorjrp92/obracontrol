"use server";

import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds } from "@/lib/access";
import { getDetalleEvidencia, type DetalleEvidencia } from "@/lib/data-mapa-evidencias";
import { coordenadaValida, type Coordenada } from "@/lib/distancia-obra";

/**
 * Detalle de UNA evidencia del mapa: la foto firmada, la tarea, quién la tomó,
 * cuándo y a qué distancia de la obra.
 *
 * Va por acción de servidor y no dentro de la carga de la página porque las
 * fotos del bucket son PRIVADAS y su URL hay que firmarla: la obra más grande
 * de producción tiene 3.348 evidencias y de esas se abren tres. Firmarlas todas
 * por adelantado sería pagar 3.348 firmas —y la espera— para tirar 3.345.
 *
 * Repite la autenticación y el recorte de obras desde cero en vez de confiar en
 * lo que el cliente mande. Una acción de servidor es un endpoint público: lo
 * único que llega es el par (obra, evidencia), y los dos se validan aquí.
 */
export async function detalleEvidenciaAction(
  proyectoId: string,
  evidenciaId: string,
): Promise<DetalleEvidencia | null> {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) return null;

  const accesibles = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  // Un ADMIN_PROYECTO solo ve las obras que le asignaron. Sin esta línea, el id
  // de otra obra de la MISMA constructora pasaría el filtro de tenant.
  if (accesibles !== "ALL" && !accesibles.includes(proyectoId)) return null;

  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: usuario.constructora_id },
    select: { ubicacion_lat: true, ubicacion_lng: true },
  });
  if (!proyecto) return null;

  const ubicacion: Coordenada | null =
    proyecto.ubicacion_lat !== null && proyecto.ubicacion_lng !== null
      ? { lat: proyecto.ubicacion_lat, lng: proyecto.ubicacion_lng }
      : null;

  return getDetalleEvidencia(
    proyectoId,
    evidenciaId,
    usuario.constructora_id,
    coordenadaValida(ubicacion) ? ubicacion : null,
  );
}
