import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateObreroToken } from "@/lib/data-obrero";
import { crearNotificacion, getProjectSupervisors } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { tareaReportadaEmailHtml } from "@/lib/email-templates/notifications";

// POST /api/o/[token]/tareas/[id]/reportar — obrero reports task as done
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;

    const obrero = await validateObreroToken(token);
    if (!obrero) {
      return NextResponse.json(
        { error: "Token invalido o expirado" },
        { status: 401 }
      );
    }

    // Find the task with project context for supervisor notifications
    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        espacio: {
          include: {
            unidad: {
              include: {
                piso: {
                  include: {
                    edificio: {
                      include: {
                        proyecto: { select: { id: true, nombre: true, constructora_id: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tarea) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      );
    }

    // Security: verify task is assigned to the obrero's contratista
    if (tarea.asignado_a !== obrero.contratista_id) {
      return NextResponse.json(
        { error: "No tienes permiso para reportar esta tarea" },
        { status: 403 }
      );
    }

    // Verify task is in a reportable state
    if (tarea.estado !== "PENDIENTE" && tarea.estado !== "NO_APROBADA") {
      return NextResponse.json(
        {
          error:
            "Solo se puede reportar una tarea en estado PENDIENTE o NO_APROBADA",
        },
        { status: 400 }
      );
    }

    // Guard: no marcar como reportada si las fotos no llegaron al servidor
    // (del intento actual). Da un error claro en vez de un estado fantasma.
    const ultimoRechazo = await prisma.aprobacion.findFirst({
      where: { tarea_id: id, estado: "NO_APROBADA" },
      orderBy: { fecha: "desc" },
      select: { fecha: true },
    });
    const evidenciaCount = await prisma.evidencia.count({
      where: { tarea_id: id, ...(ultimoRechazo ? { created_at: { gt: ultimoRechazo.fecha } } : {}) },
    });
    if (evidenciaCount < 1) {
      return NextResponse.json(
        { error: "Las fotos aún no se han subido. Espera a que terminen de cargar e intenta de nuevo." },
        { status: 400 }
      );
    }

    // Update task
    const updated = await prisma.tarea.update({
      where: { id },
      data: {
        estado: "REPORTADA",
        fecha_inicio: tarea.fecha_inicio ?? new Date(),
      },
    });

    // 1. Notificación al contratista del obrero
    try {
      await crearNotificacion({
        usuario_id: obrero.contratista_id,
        tipo: "OBRERO_REPORTO",
        titulo: `Tarea reportada por ${obrero.nombre}`,
        mensaje: `${obrero.nombre} reportó la tarea "${tarea.nombre}" como terminada.`,
        link: `/contratista`,
      });
    } catch (err) {
      console.error("Error creando notificacion al contratista:", err);
    }

    // 2. Notificación + email a los supervisores del proyecto
    try {
      const proyectoId = tarea.espacio.unidad.piso.edificio.proyecto.id;
      const constructoraId = tarea.espacio.unidad.piso.edificio.proyecto.constructora_id;
      const supervisores = await getProjectSupervisors(proyectoId, constructoraId);

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
      const ubicacion = `${tarea.espacio.unidad.piso.edificio.nombre} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`;

      const html = tareaReportadaEmailHtml({
        nombre: tarea.nombre,
        proyecto: tarea.espacio.unidad.piso.edificio.proyecto.nombre,
        ubicacion,
        contratista: obrero.nombre,
        url: `${siteUrl}/dashboard/tareas/${id}`,
      });

      for (const sup of supervisores) {
        crearNotificacion({
          usuario_id: sup.id,
          tipo: "TAREA_REPORTADA",
          titulo: `Tarea reportada: ${tarea.nombre}`,
          mensaje: `${obrero.nombre} reportó "${tarea.nombre}" en ${ubicacion}. Revisa y aprueba o rechaza.`,
          link: `/dashboard/tareas/${id}`,
        }).catch((err) => console.error("Notificación TAREA_REPORTADA falló:", err));

        sendEmail({
          to: sup.email,
          subject: `Tarea reportada: ${tarea.nombre}`,
          html,
        }).catch((err) => console.error("Email reportada falló:", err));
      }
    } catch (err) {
      console.error("Error notificando a supervisores:", err);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/o/[token]/tareas/[id]/reportar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
