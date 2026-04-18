import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";

// POST /api/extensiones — solicitar extensión de tiempo (admin/coordinador)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || !canApproveTasks(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para autorizar extensiones" }, { status: 403 });
    }

    const body = await req.json();
    const { tarea_id, dias_adicionales, justificacion, documentacion_url } = body;

    if (!tarea_id || !dias_adicionales || !justificacion) {
      return NextResponse.json(
        { error: "tarea_id, dias_adicionales y justificacion son requeridos" },
        { status: 400 }
      );
    }

    if (dias_adicionales < 1 || dias_adicionales > 365) {
      return NextResponse.json({ error: "dias_adicionales debe estar entre 1 y 365" }, { status: 400 });
    }

    const tarea = await prisma.tarea.findUnique({
      where: { id: tarea_id },
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
    if (!tarea) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Project-level access check
    const proyectoIdForTarea = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { tareas: { some: { id: tarea_id } } } } } } } } } },
      },
      select: { id: true },
    });
    const accessibleExt = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    if (!proyectoIdForTarea || !canAccessProject(accessibleExt, proyectoIdForTarea.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    // Tenant isolation: verify the task belongs to the user's constructora
    if (tarea.espacio.unidad.piso.edificio.proyecto.constructora_id !== usuario.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Crear extensión + sumar días al tiempo acordado en una transacción
    const [extension] = await prisma.$transaction([
      prisma.extensionTiempo.create({
        data: {
          tarea_id,
          dias_adicionales: Number(dias_adicionales),
          justificacion,
          documentacion_url: documentacion_url ?? "",
          autorizado_por: usuario.id,
        },
      }),
      prisma.tarea.update({
        where: { id: tarea_id },
        data: { tiempo_acordado_dias: tarea.tiempo_acordado_dias + Number(dias_adicionales) },
      }),
    ]);

    return NextResponse.json(extension, { status: 201 });
  } catch (error) {
    console.error("POST /api/extensiones", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
