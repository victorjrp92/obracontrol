import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularScoreContratista } from "@/lib/scoring";
import {
  requireUser,
  assertProyectoInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";

// GET /api/contratistas?proyecto_id=
export async function GET(req: NextRequest) {
  try {
    const { constructoraId } = await requireUser();

    const proyecto_id = new URL(req.url).searchParams.get("proyecto_id");

    if (proyecto_id) {
      await assertProyectoInTenant(proyecto_id, constructoraId);
    }

    const contratistas = await prisma.contratista.findMany({
      where: {
        // Siempre filtrar por constructora del usuario
        usuario: { constructora_id: constructoraId },
        // Si se pasó proyecto, además requiere tareas en ese proyecto
        ...(proyecto_id && {
          usuario: {
            constructora_id: constructoraId,
            tareas_asignadas: {
              some: {
                espacio: {
                  unidad: {
                    piso: { edificio: { proyecto_id } },
                  },
                },
              },
            },
          },
        }),
      },
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true, rol: true },
        },
      },
      orderBy: { score_total: "desc" },
    });

    return NextResponse.json(contratistas);
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("GET /api/contratistas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/contratistas — forzar recálculo de score
export async function POST(req: NextRequest) {
  try {
    const { constructoraId } = await requireUser();

    const { contratista_id } = await req.json();
    if (!contratista_id) {
      return NextResponse.json({ error: "contratista_id requerido" }, { status: 400 });
    }

    // Verificar que el contratista pertenezca a la misma constructora
    const pertenece = await prisma.contratista.count({
      where: {
        id: contratista_id,
        usuario: { constructora_id: constructoraId },
      },
    });
    if (pertenece === 0) {
      return NextResponse.json({ error: "Contratista no encontrado" }, { status: 404 });
    }

    await recalcularScoreContratista(contratista_id);

    const updated = await prisma.contratista.findUnique({
      where: { id: contratista_id },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("POST /api/contratistas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
