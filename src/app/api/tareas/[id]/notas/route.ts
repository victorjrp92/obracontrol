import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";

// PATCH /api/tareas/[id]/notas — actualizar notas de una tarea
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Only supervisors (admins / directivo) may edit task notes.
    if (!canApproveTasks(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Tenant isolation: verify the task belongs to the user's constructora
    const existingTarea = await prisma.tarea.findUnique({
      where: { id },
      select: {
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

    if (!existingTarea || existingTarea.espacio.unidad.piso.edificio.proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Project-access: ADMIN_PROYECTO must have the project in their assignments.
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, existingTarea.espacio.unidad.piso.edificio.proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    const body = await req.json();
    const { notas } = body as { notas?: string | null };

    // Bound the notes length to avoid abuse.
    if (typeof notas === "string" && notas.length > 4000) {
      return NextResponse.json({ error: "Las notas no pueden superar 4000 caracteres" }, { status: 400 });
    }

    const tarea = await prisma.tarea.update({
      where: { id },
      data: { notas: notas ?? null },
    });

    return NextResponse.json(tarea);
  } catch (error) {
    console.error("PATCH /api/tareas/[id]/notas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
