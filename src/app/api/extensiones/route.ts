import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  requireRole,
  assertTareaInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";

// POST /api/extensiones — solicitar extensión de tiempo (admin/coordinador)
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireUser();
    requireRole(ctx, "ADMIN", "JEFE_OPERACIONES", "COORDINADOR");

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

    await assertTareaInTenant(tarea_id, ctx.constructoraId);

    const tarea = await prisma.tarea.findUnique({ where: { id: tarea_id } });
    if (!tarea) {
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
          autorizado_por: ctx.usuario.id,
        },
      }),
      prisma.tarea.update({
        where: { id: tarea_id },
        data: { tiempo_acordado_dias: tarea.tiempo_acordado_dias + Number(dias_adicionales) },
      }),
    ]);

    return NextResponse.json(extension, { status: 201 });
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("POST /api/extensiones", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
