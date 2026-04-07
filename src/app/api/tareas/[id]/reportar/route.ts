import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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

    const tarea = await prisma.tarea.findUnique({ where: { id } });
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/tareas/[id]/reportar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
