import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
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

    if (!existingTarea || existingTarea.espacio.unidad.piso.edificio.proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const { notas } = body;

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
