import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertTareaInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";

// PATCH /api/tareas/[id]/notas — actualizar notas de una tarea
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { constructoraId } = await requireUser();
    const { id } = await params;

    await assertTareaInTenant(id, constructoraId);

    const body = await req.json();
    const { notas } = body;

    const tarea = await prisma.tarea.update({
      where: { id },
      data: { notas: notas ?? null },
    });

    return NextResponse.json(tarea);
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("PATCH /api/tareas/[id]/notas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
