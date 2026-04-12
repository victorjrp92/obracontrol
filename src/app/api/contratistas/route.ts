import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recalcularScoreContratista } from "@/lib/scoring";

// GET /api/contratistas?proyecto_id=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const proyecto_id = new URL(req.url).searchParams.get("proyecto_id");

    const contratistas = await prisma.contratista.findMany({
      where: proyecto_id
        ? {
            usuario: {
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
          }
        : undefined,
      include: {
        usuario: {
          select: { id: true, nombre: true, email: true, rol_ref: { select: { nombre: true, nivel_acceso: true } } },
        },
      },
      orderBy: { score_total: "desc" },
    });

    return NextResponse.json(contratistas);
  } catch (error) {
    console.error("GET /api/contratistas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/contratistas/[id]/recalcular — forzar recálculo de score
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { contratista_id } = await req.json();
    if (!contratista_id) {
      return NextResponse.json({ error: "contratista_id requerido" }, { status: 400 });
    }

    await recalcularScoreContratista(contratista_id);

    const updated = await prisma.contratista.findUnique({
      where: { id: contratista_id },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/contratistas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
