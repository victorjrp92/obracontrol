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

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const proyecto_id = new URL(req.url).searchParams.get("proyecto_id");

    const contratistas = await prisma.contratista.findMany({
      where: {
        // Tenant isolation: only contratistas from this constructora
        usuario: {
          constructora_id: currentUser.constructora_id,
          ...(proyecto_id
            ? {
                tareas_asignadas: {
                  some: {
                    espacio: {
                      unidad: {
                        piso: { edificio: { proyecto_id } },
                      },
                    },
                  },
                },
              }
            : {}),
        },
      },
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

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!currentUser || !["ADMINISTRADOR", "DIRECTIVO"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { contratista_id } = await req.json();
    if (!contratista_id) {
      return NextResponse.json({ error: "contratista_id requerido" }, { status: 400 });
    }

    // Tenant isolation: verify contratista belongs to this constructora
    const contratista = await prisma.contratista.findUnique({
      where: { id: contratista_id },
      include: { usuario: { select: { constructora_id: true } } },
    });
    if (!contratista || contratista.usuario.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Contratista no encontrado" }, { status: 404 });
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
