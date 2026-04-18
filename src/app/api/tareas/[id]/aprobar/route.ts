import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recalcularScoreContratista } from "@/lib/scoring";
import { sendEmail } from "@/lib/email";
import { tareaAprobadaEmailHtml, tareaNoAprobadaEmailHtml } from "@/lib/email-templates/notifications";
import { crearNotificacion } from "@/lib/notifications";
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";

// POST /api/tareas/[id]/aprobar — supervisor aprueba o no aprueba
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

    const aprobador = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!aprobador || !canApproveTasks(aprobador.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para aprobar" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { estado, items_no_aprobados, justificacion_por_item } = body;

    if (!["APROBADA", "NO_APROBADA"].includes(estado)) {
      return NextResponse.json({ error: "estado debe ser APROBADA o NO_APROBADA" }, { status: 400 });
    }

    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        espacio: {
          select: {
            unidad: {
              select: {
                piso: {
                  select: {
                    edificio: {
                      select: { proyecto: { select: { constructora_id: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!tarea || tarea.estado !== "REPORTADA") {
      return NextResponse.json({ error: "Tarea no encontrada o no está reportada" }, { status: 400 });
    }

    // Project-access check: scope by accessible projects for this user
    const proyectoIdForTask = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { tareas: { some: { id } } } } } } } } } },
      },
      select: { id: true },
    });
    const accessibleApr = await getAccessibleProjectIds(
      aprobador.id,
      aprobador.constructora_id,
      aprobador.rol_ref.nivel_acceso,
    );
    if (!proyectoIdForTask || !canAccessProject(accessibleApr, proyectoIdForTask.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    // Tenant isolation: verify the task belongs to the approver's constructora
    if (tarea.espacio.unidad.piso.edificio.proyecto.constructora_id !== aprobador.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Transacción: crear aprobación + actualizar tarea
    const [aprobacion, tareaActualizada] = await prisma.$transaction([
      prisma.aprobacion.create({
        data: {
          tarea_id: id,
          aprobador_id: aprobador.id,
          estado,
          items_no_aprobados: items_no_aprobados ?? null,
          justificacion_por_item: justificacion_por_item ?? null,
        },
      }),
      prisma.tarea.update({
        where: { id },
        data: {
          estado: estado === "APROBADA" ? "APROBADA" : "NO_APROBADA",
          fecha_fin_real: estado === "APROBADA" ? new Date() : null,
        },
      }),
    ]);

    // Recalcular score del contratista si tiene uno asignado
    if (tareaActualizada.asignado_a) {
      const contratista = await prisma.contratista.findUnique({
        where: { usuario_id: tareaActualizada.asignado_a },
      });
      if (contratista) {
        await recalcularScoreContratista(contratista.id);
      }
    }

    // Crear notificación in-app para el contratista asignado
    if (tareaActualizada.asignado_a) {
      try {
        await crearNotificacion({
          usuario_id: tareaActualizada.asignado_a,
          tipo: estado === "APROBADA" ? "TAREA_APROBADA" : "TAREA_RECHAZADA",
          titulo: estado === "APROBADA" ? "Tarea aprobada" : "Tarea no aprobada",
          mensaje: `Tu tarea "${tarea.nombre}" fue ${estado === "APROBADA" ? "aprobada" : "rechazada"}`,
          link: `/contratista?estado=${estado}`,
        });
      } catch (err) {
        console.error("Error creando notificación de aprobación:", err);
      }
    }

    // Enviar email al contratista asignado
    if (tareaActualizada.asignado_a) {
      try {
        const contratistaInfo = await prisma.usuario.findUnique({
          where: { id: tareaActualizada.asignado_a },
          select: { email: true, nombre: true },
        });

        const tareaInfo = await prisma.tarea.findUnique({
          where: { id },
          include: {
            espacio: {
              include: {
                unidad: {
                  include: {
                    piso: {
                      include: {
                        edificio: { include: { proyecto: { select: { nombre: true } } } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (contratistaInfo && tareaInfo) {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
          const ubicacion = `${tareaInfo.espacio.unidad.piso.edificio.nombre} · Apto ${tareaInfo.espacio.unidad.nombre} · ${tareaInfo.espacio.nombre}`;
          const proyectoNombre = tareaInfo.espacio.unidad.piso.edificio.proyecto.nombre;

          const html = estado === "APROBADA"
            ? tareaAprobadaEmailHtml({
                nombre: tareaInfo.nombre,
                proyecto: proyectoNombre,
                ubicacion,
                url: `${siteUrl}/dashboard/tareas/${id}`,
              })
            : tareaNoAprobadaEmailHtml({
                nombre: tareaInfo.nombre,
                proyecto: proyectoNombre,
                ubicacion,
                motivo: typeof justificacion_por_item === "object" && justificacion_por_item !== null
                  ? (justificacion_por_item as Record<string, string>).motivo ?? "Sin especificar"
                  : "Sin especificar",
                url: `${siteUrl}/dashboard/tareas/${id}`,
              });

          sendEmail({
            to: contratistaInfo.email,
            subject: estado === "APROBADA" ? `Tarea aprobada: ${tareaInfo.nombre}` : `Tarea no aprobada: ${tareaInfo.nombre}`,
            html,
          }).catch((err) => console.error("Email aprobación falló:", err));
        }
      } catch (err) {
        console.error("Error enviando email de aprobación:", err);
      }
    }

    return NextResponse.json({ aprobacion, tarea: tareaActualizada });
  } catch (error) {
    console.error("POST /api/tareas/[id]/aprobar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
