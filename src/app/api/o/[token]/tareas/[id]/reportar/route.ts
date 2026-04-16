import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateObreroToken } from "@/lib/data-obrero";

// POST /api/o/[token]/tareas/[id]/reportar — obrero reports task as done
export async function POST(
  req: NextRequest,
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

    // Find the task
    const tarea = await prisma.tarea.findUnique({
      where: { id },
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

    // Update task
    const updated = await prisma.tarea.update({
      where: { id },
      data: {
        estado: "REPORTADA",
        fecha_inicio: tarea.fecha_inicio ?? new Date(),
      },
    });

    // Create notification for the contratista
    try {
      await prisma.notificacion.create({
        data: {
          usuario_id: obrero.contratista_id,
          tipo: "OBRERO_REPORTO",
          titulo: `Tarea reportada por ${obrero.nombre}`,
          mensaje: `${obrero.nombre} reporto la tarea "${tarea.nombre}" como terminada.`,
          link: `/contratista`,
        },
      });
    } catch (err) {
      console.error("Error creando notificacion:", err);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/o/[token]/tareas/[id]/reportar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
