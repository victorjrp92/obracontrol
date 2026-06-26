import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sugerirTareasIA } from "@/lib/deepseek";

const MAX_ESPACIOS = 40;
const MAX_NOMBRE = 80;

/**
 * POST /api/sugerencias/tareas — sugerencias de tareas por espacio (DeepSeek).
 *
 * Solo B2C (cuentas personales). Devuelve { sugerencias: { espacio: [{nombre,dias}] } }
 * o { sugerencias: null } si la IA no está disponible / falla → el cliente cae
 * a las plantillas estáticas. Requiere usuario autenticado (protege el gasto).
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
    if (!body || !Array.isArray(body.espacios)) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const espacios: string[] = body.espacios
      .filter((e: unknown): e is string => typeof e === "string" && e.trim().length > 0)
      .map((e: string) => e.trim().slice(0, MAX_NOMBRE))
      .slice(0, MAX_ESPACIOS);
    if (espacios.length === 0) {
      return NextResponse.json({ sugerencias: null });
    }

    const tipoObra = typeof body.tipoObra === "string" ? body.tipoObra : "REFORMA";
    const tipoPropiedad = typeof body.tipoPropiedad === "string" ? body.tipoPropiedad : "CASA";
    const ciudad = typeof body.ciudad === "string" ? body.ciudad.slice(0, 80) : null;
    const puntoPartida = typeof body.puntoPartida === "string" ? body.puntoPartida : null;

    const r = await sugerirTareasIA({ espacios, tipoObra, tipoPropiedad, ciudad, puntoPartida });
    if (r.ok) {
      return NextResponse.json({ sugerencias: r.data, fuente: "ia" });
    }
    // motivo: "sin_key" (falta DEEPSEEK_API_KEY en el entorno) | "error"
    return NextResponse.json({ sugerencias: null, fuente: r.motivo });
  } catch {
    // Nunca rompemos el flujo: el cliente usa el fallback estático.
    return NextResponse.json({ sugerencias: null, fuente: "error" });
  }
}
