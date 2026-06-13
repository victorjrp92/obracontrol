import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { tareaReportadaEmailHtml } from "@/lib/email-templates/notifications";
import { canApproveTasks, getAccessibleProjectIds, canAccessProject } from "@/lib/access";
import { crearNotificacion, getProjectSupervisors } from "@/lib/notifications";

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

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        constructora_id: true,
        rol_ref: { select: { nivel_acceso: true } },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { id } = await params;

    // Body es opcional para compatibilidad (POST sin body); si viene, leemos nota_reporte.
    let nota_reporte: string | null = null;
    try {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const body = (await req.json()) as { nota_reporte?: string };
        if (typeof body.nota_reporte === "string") {
          const trimmed = body.nota_reporte.trim();
          if (trimmed.length > 0) nota_reporte = trimmed.slice(0, 1000);
        }
      }
    } catch {
      // ignore — JSON inválido o sin body
    }

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
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Tenant isolation: verify the task belongs to the user's constructora
    if (tarea.espacio.unidad.piso.edificio.proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Authorization: only the asignado contratista (or supervisors who can approve)
    // may report a task complete. Previously any authenticated user in the
    // constructora could mark somebody else's task as REPORTADA.
    const esAsignado = tarea.asignado_a === currentUser.id;
    const esSupervisor = canApproveTasks(currentUser.rol_ref.nivel_acceso);
    if (!esAsignado && !esSupervisor) {
      return NextResponse.json(
        { error: "Solo el contratista asignado o un supervisor puede reportar esta tarea" },
        { status: 403 }
      );
    }

    // Project-access: a supervisor (e.g. ADMIN_PROYECTO) must have the project
    // in their assignments before reporting someone else's task.
    if (esSupervisor && !esAsignado) {
      const accessible = await getAccessibleProjectIds(
        currentUser.id,
        currentUser.constructora_id,
        currentUser.rol_ref.nivel_acceso,
      );
      if (!canAccessProject(accessible, tarea.espacio.unidad.piso.edificio.proyecto.id)) {
        return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
      }
    }

    if (tarea.estado !== "PENDIENTE" && tarea.estado !== "NO_APROBADA") {
      return NextResponse.json(
        { error: "Solo se puede reportar una tarea en estado PENDIENTE o NO_APROBADA" },
        { status: 400 }
      );
    }

    // Guard: no permitir reportar sin evidencia en el servidor (del intento
    // actual). Evita el estado confuso "Reportada sin fotos" cuando una subida
    // falla. Solo cuentan las evidencias creadas tras el último rechazo.
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
        { error: "Sube al menos una foto de evidencia antes de reportar la tarea." },
        { status: 400 }
      );
    }

    const updated = await prisma.tarea.update({
      where: { id },
      data: {
        estado: "REPORTADA",
        fecha_inicio: tarea.fecha_inicio ?? new Date(),
        // Si el contratista escribió nota, la guardamos; si vino null la
        // limpiamos para que un re-reporte no muestre la nota anterior.
        nota_reporte,
      },
    });

    // Notificar a supervisores del proyecto (in-app + email)
    try {
      const proyectoId = tarea.espacio.unidad.piso.edificio.proyecto.id;
      const constructoraId = tarea.espacio.unidad.piso.edificio.proyecto.constructora_id;
      const supervisores = await getProjectSupervisors(
        proyectoId,
        constructoraId,
        currentUser.id,
      );

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
      const ubicacion = `${tarea.espacio.unidad.piso.edificio.nombre} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`;
      const reporterNombre = tarea.asignado_usuario?.nombre ?? "Un contratista";

      const html = tareaReportadaEmailHtml({
        nombre: tarea.nombre,
        proyecto: tarea.espacio.unidad.piso.edificio.proyecto.nombre,
        ubicacion,
        contratista: tarea.asignado_usuario?.nombre,
        url: `${siteUrl}/dashboard/tareas/${id}`,
      });

      for (const sup of supervisores) {
        // Notificación in-app (no bloqueante)
        crearNotificacion({
          usuario_id: sup.id,
          tipo: "TAREA_REPORTADA",
          titulo: `Tarea reportada: ${tarea.nombre}`,
          mensaje: `${reporterNombre} reportó "${tarea.nombre}" en ${ubicacion}. Revisa y aprueba o rechaza.`,
          link: `/dashboard/tareas/${id}`,
        }).catch((err) => console.error("Notificación TAREA_REPORTADA falló:", err));

        // Email (no bloqueante)
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
    console.error("POST /api/tareas/[id]/reportar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
