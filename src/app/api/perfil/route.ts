import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true },
    });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { nombre, telefono } = body as { nombre?: string; telefono?: string };

    const data: Record<string, string> = {};
    if (nombre && nombre.trim().length >= 2) data.nombre = nombre.trim();
    if (telefono !== undefined) data.telefono = telefono.trim() || "";

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    await prisma.usuario.update({ where: { id: usuario.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/perfil", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
