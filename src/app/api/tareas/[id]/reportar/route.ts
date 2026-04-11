import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { tareaReportadaEmailHtml } from "@/lib/email-templates/notifications";

// POST /api/tareas/[id]/reportar — obrero reporta tarea terminada
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        asignado_usuario: { select: { nombre: true } },
        espacio: {
          include: {
            unidad: {
              include: {
                piso: {
                  include: {
                    edificio: {
                      include: {
                        proyecto: { select: { nombre: true, constructora_id: true } },
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
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    if (tarea.estado !== "PENDIENTE" && tarea.estado !== "NO_APROBADA") {
      return NextResponse.json(
        { error: "Solo se puede reportar una tarea en estado PENDIENTE o NO_APROBADA" },
        { status: 400 }
      );
    }

    const updated = await prisma.tarea.update({
      where: { id },
      data: {
        estado: "REPORTADA",
        fecha_inicio: tarea.fecha_inicio ?? new Date(),
      },
    });

    // Enviar email a supervisores (admin/jefe/coordinador) de la constructora
    try {
      const supervisores = await prisma.usuario.findMany({
        where: {
          constructora_id: tarea.espacio.unidad.piso.edificio.proyecto.constructora_id,
          rol: { in: ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR"] },
        },
        select: { email: true },
      });

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
      const ubicacion = `${tarea.espacio.unidad.piso.edificio.nombre} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`;
      const html = tareaReportadaEmailHtml({
        nombre: tarea.nombre,
        proyecto: tarea.espacio.unidad.piso.edificio.proyecto.nombre,
        ubicacion,
        contratista: tarea.asignado_usuario?.nombre,
        url: `${siteUrl}/dashboard/tareas/${id}`,
      });

      for (const sup of supervisores) {
        sendEmail({
          to: sup.email,
          subject: `Tarea reportada: ${tarea.nombre}`,
          html,
        }).catch((err) => console.error("Email reportada falló:", err));
      }
    } catch (err) {
      console.error("Error enviando emails de tarea reportada:", err);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/tareas/[id]/reportar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
