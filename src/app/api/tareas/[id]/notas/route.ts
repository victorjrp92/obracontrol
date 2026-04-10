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

    const { id } = await params;
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
