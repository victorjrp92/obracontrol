import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
      select: { id: true, rol: true },
    });

    const rolesAprobadores = ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR", "ASISTENTE"];
    if (!aprobador || !rolesAprobadores.includes(aprobador.rol)) {
      return NextResponse.json({ error: "Sin permisos para aprobar" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { estado, items_no_aprobados, justificacion_por_item } = body;

    if (!["APROBADA", "NO_APROBADA"].includes(estado)) {
      return NextResponse.json({ error: "estado debe ser APROBADA o NO_APROBADA" }, { status: 400 });
    }

    const tarea = await prisma.tarea.findUnique({ where: { id } });
    if (!tarea || tarea.estado !== "REPORTADA") {
      return NextResponse.json({ error: "Tarea no encontrada o no está reportada" }, { status: 400 });
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

    return NextResponse.json({ aprobacion, tarea: tareaActualizada });
  } catch (error) {
    console.error("POST /api/tareas/[id]/aprobar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
