import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// POST /api/retrasos — registrar retraso en una tarea
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { tarea_id, tipo, justificacion, evidencia_urls } = body;

    if (!tarea_id || !tipo || !justificacion) {
      return NextResponse.json(
        { error: "tarea_id, tipo y justificacion son requeridos" },
        { status: 400 }
      );
    }

    const tiposValidos = ["POR_CONTRATISTA", "POR_FALTA_PISTA", "OTRO"];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    // Si es por falta de pista, requiere evidencia
    if (tipo === "POR_FALTA_PISTA" && (!evidencia_urls || evidencia_urls.length === 0)) {
      return NextResponse.json(
        { error: "Retrasos por falta de pista requieren evidencia" },
        { status: 400 }
      );
    }

    const retraso = await prisma.retraso.create({
      data: {
        tarea_id,
        tipo,
        justificacion,
        evidencia_urls: evidencia_urls ?? [],
      },
    });

    return NextResponse.json(retraso, { status: 201 });
  } catch (error) {
    console.error("POST /api/retrasos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/retrasos?tarea_id=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const tarea_id = new URL(req.url).searchParams.get("tarea_id");
    if (!tarea_id) return NextResponse.json({ error: "tarea_id requerido" }, { status: 400 });

    const retrasos = await prisma.retraso.findMany({
      where: { tarea_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(retrasos);
  } catch (error) {
    console.error("GET /api/retrasos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
