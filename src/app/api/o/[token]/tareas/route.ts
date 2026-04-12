import { NextRequest, NextResponse } from "next/server";
import { getObreroTareas, validateObreroToken } from "@/lib/data-obrero";

// GET /api/o/[token]/tareas — list tasks for this obrero's contratista
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const obrero = await validateObreroToken(token);
    if (!obrero) {
      return NextResponse.json(
        { error: "Token invalido o expirado" },
        { status: 401 }
      );
    }

    const tareas = await getObreroTareas(
      obrero.contratista_id,
      obrero.constructora_id
    );

    return NextResponse.json(tareas);
  } catch (error) {
    console.error("GET /api/o/[token]/tareas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
