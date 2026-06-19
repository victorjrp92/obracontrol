import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { estimarPreciosIA, type TareaPrecioInput } from "@/lib/deepseek";

const MAX_TAREAS = 200;
const MAX_TXT = 120;

/**
 * POST /api/sugerencias/presupuesto — estima el costo total (COP) por tarea con
 * IA anclada en la base semilla de precios de Colombia. Solo B2C / autenticado.
 * Devuelve { precios: { <i>: <COP> } | null, fuente: "ia"|"sin_key"|"error" }.
 * Si la IA no está disponible, el cliente usa el estimador determinista.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (!currentUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.tareas)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const tareas: TareaPrecioInput[] = body.tareas
      .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === "object")
      .slice(0, MAX_TAREAS)
      .map((t: Record<string, unknown>) => ({
        i: Number(t.i),
        espacio: typeof t.espacio === "string" ? t.espacio.slice(0, MAX_TXT) : "",
        tarea: typeof t.tarea === "string" ? t.tarea.slice(0, MAX_TXT) : "",
        dias: Math.max(1, Math.round(Number(t.dias) || 1)),
        metraje: typeof t.metraje === "number" && t.metraje > 0 ? t.metraje : undefined,
      }))
      .filter((t: TareaPrecioInput) => Number.isInteger(t.i) && t.tarea);

    if (tareas.length === 0) {
      return NextResponse.json({ precios: null, fuente: "error" });
    }

    const tipoObra = typeof body.tipoObra === "string" ? body.tipoObra : "REFORMA";
    const tipoPropiedad = typeof body.tipoPropiedad === "string" ? body.tipoPropiedad : "CASA";
    const ciudad = typeof body.ciudad === "string" ? body.ciudad.slice(0, 80) : null;

    const r = await estimarPreciosIA({ tareas, tipoObra, tipoPropiedad, ciudad });
    if (r.ok) {
      return NextResponse.json({ precios: r.data, fuente: "ia" });
    }
    return NextResponse.json({ precios: null, fuente: r.motivo });
  } catch {
    return NextResponse.json({ precios: null, fuente: "error" });
  }
}
