import { NextResponse } from "next/server";
import { validarClienteToken, getClienteAvance } from "@/lib/data-cliente";

// GET /api/c/[token] — PÚBLICA (sin login).
// Devuelve SOLO el avance de la obra a la que apunta el token: nombre de la
// obra, progreso global, semáforo y tareas con su estado (+ fotos de las
// aprobadas). NO expone datos personales de trabajadores, costos, presupuesto,
// gastos/anticipos, ni datos de otra obra. Tenant-safe por construcción.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const valido = await validarClienteToken(token);
    if (!valido) {
      // 410 Gone: el enlace existió pero fue revocado o nunca fue válido.
      return NextResponse.json(
        { error: "Enlace no válido o desactivado" },
        { status: 410 },
      );
    }

    const avance = await getClienteAvance(valido.proyectoId);
    if (!avance) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    return NextResponse.json(avance);
  } catch (error) {
    console.error("GET /api/c/[token]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
