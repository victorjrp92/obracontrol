import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { retrasoRegistradoEmailHtml } from "@/lib/email-templates/notifications";
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";

// POST /api/retrasos — registrar retraso en una tarea
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const body = await req.json();
    const { tarea_id, tipo, justificacion, evidencia_urls } = body;

    if (!tarea_id || !tipo || !justificacion) {
      return NextResponse.json(
        { error: "tarea_id, tipo y justificacion son requeridos" },
        { status: 400 }
      );
    }

    const tiposValidos = ["POR_CONTRATISTA", "POR_FALTA_PISTA", "OTRO"];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    // Si es por falta de pista, requiere evidencia
    if (tipo === "POR_FALTA_PISTA" && (!evidencia_urls || evidencia_urls.length === 0)) {
      return NextResponse.json(
        { error: "Retrasos por falta de pista requieren evidencia" },
        { status: 400 }
      );
    }

    // Tenant isolation + project-access + role check: only supervisors (admins /
    // directivo) or the contratista assigned to the task may register a delay.
    const tareaCheck = await prisma.tarea.findUnique({
      where: { id: tarea_id },
      select: {
        asignado_a: true,
        espacio: {
          select: {
            unidad: {
              select: {
                piso: {
                  select: {
                    edificio: {
                      select: {
                        proyecto_id: true,
                        proyecto: { select: { constructora_id: true } },
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
    if (!tareaCheck || tareaCheck.espacio.unidad.piso.edificio.proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const esAsignado = tareaCheck.asignado_a === currentUser.id;
    const esSupervisor = canApproveTasks(currentUser.rol_ref.nivel_acceso);
    if (!esAsignado && !esSupervisor) {
      return NextResponse.json(
        { error: "Sin permisos para registrar retrasos en esta tarea" },
        { status: 403 }
      );
    }

    // Project-access: if the caller is a supervisor (e.g. ADMIN_PROYECTO), the
    // task's project must be in their assignments. Contratistas are allowed
    // through when they own the task regardless of the scope helper.
    if (esSupervisor) {
      const accessible = await getAccessibleProjectIds(
        currentUser.id,
        currentUser.constructora_id,
        currentUser.rol_ref.nivel_acceso,
      );
      if (!canAccessProject(accessible, tareaCheck.espacio.unidad.piso.edificio.proyecto_id)) {
        return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
      }
    }

    const retraso = await prisma.retraso.create({
      data: {
        tarea_id,
        tipo,
        justificacion,
        evidencia_urls: evidencia_urls ?? [],
      },
    });

    // Notificar a admins/coordinadores
    try {
      const tareaInfo = await prisma.tarea.findUnique({
        where: { id: tarea_id },
        include: {
          espacio: {
            include: {
              unidad: {
                include: {
                  piso: {
                    include: {
                      edificio: {
                        include: { proyecto: { select: { nombre: true, constructora_id: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (tareaInfo) {
        const supervisores = await prisma.usuario.findMany({
          where: {
            constructora_id: tareaInfo.espacio.unidad.piso.edificio.proyecto.constructora_id,
            rol_ref: { nivel_acceso: { in: ["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"] } },
          },
          select: { email: true },
        });

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
        const ubicacion = `${tareaInfo.espacio.unidad.piso.edificio.nombre} · Apto ${tareaInfo.espacio.unidad.nombre} · ${tareaInfo.espacio.nombre}`;
        const tipoLabel = tipo === "POR_FALTA_PISTA"
          ? "Por falta de pista"
          : tipo === "POR_CONTRATISTA"
          ? "Por contratista"
          : "Otro motivo";

        const html = retrasoRegistradoEmailHtml({
          nombre: tareaInfo.nombre,
          proyecto: tareaInfo.espacio.unidad.piso.edificio.proyecto.nombre,
          ubicacion,
          tipoRetraso: tipoLabel,
          justificacion,
          url: `${siteUrl}/dashboard/tareas/${tarea_id}`,
        });

        for (const sup of supervisores) {
          sendEmail({
            to: sup.email,
            subject: `Retraso registrado: ${tareaInfo.nombre}`,
            html,
          }).catch((err) => console.error("Email retraso falló:", err));
        }
      }
    } catch (err) {
      console.error("Error enviando emails de retraso:", err);
    }

    return NextResponse.json(retraso, { status: 201 });
  } catch (error) {
    console.error("POST /api/retrasos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/retrasos?tarea_id=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const tarea_id = new URL(req.url).searchParams.get("tarea_id");
    if (!tarea_id) return NextResponse.json({ error: "tarea_id requerido" }, { status: 400 });

    // Tenant isolation: verify the task belongs to the user's constructora
    const tareaCheck = await prisma.tarea.findUnique({
      where: { id: tarea_id },
      select: {
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
    if (!tareaCheck || tareaCheck.espacio.unidad.piso.edificio.proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const retrasos = await prisma.retraso.findMany({
      where: { tarea_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(retrasos);
  } catch (error) {
    console.error("GET /api/retrasos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
