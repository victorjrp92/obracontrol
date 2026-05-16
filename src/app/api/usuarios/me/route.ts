import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// GET /api/usuarios/me — datos personales del usuario logueado
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { email: user.email! },
    include: {
      rol_ref: { select: { nombre: true, nivel_acceso: true } },
      constructora: { select: { id: true, nombre: true } },
    },
  });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  return NextResponse.json(usuario);
}

// PATCH /api/usuarios/me — el usuario edita su propia info personal.
// Solo permite editar `nombre` (más adelante `telefono`, `foto_url`, etc.)
// Email/rol/constructora NO se cambian aquí — son cambios administrativos.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const usuario = await prisma.usuario.findUnique({
    where: { email: user.email! },
    select: { id: true },
  });
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const body = await req.json();
  const { nombre } = body as { nombre?: string };
  const data: Record<string, unknown> = {};

  if (nombre !== undefined) {
    const trimmed = String(nombre).trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      return NextResponse.json(
        { error: "El nombre debe tener entre 2 y 100 caracteres" },
        { status: 400 },
      );
    }
    data.nombre = trimmed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const updated = await prisma.usuario.update({
    where: { id: usuario.id },
    data,
    select: { id: true, nombre: true, email: true },
  });
  return NextResponse.json(updated);
}
