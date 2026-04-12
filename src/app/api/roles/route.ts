import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// GET /api/roles — list roles for the current constructora
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const roles = await prisma.rol.findMany({
      where: { constructora_id: usuario.constructora_id },
      select: { id: true, nombre: true, nivel_acceso: true, es_default: true },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/roles", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
