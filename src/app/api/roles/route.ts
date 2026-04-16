import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const VALID_NIVELES = ["DIRECTIVO", "ADMINISTRADOR", "CONTRATISTA", "OBRERO"] as const;

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
      select: { id: true, nombre: true, nivel_acceso: true, es_default: true, _count: { select: { usuarios: true } } },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/roles", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/roles — create a new role for the constructora
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || currentUser.rol_ref.nivel_acceso !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, nivel_acceso } = body as { nombre?: string; nivel_acceso?: string };

    if (!nombre || !nivel_acceso) {
      return NextResponse.json({ error: "nombre y nivel_acceso son requeridos" }, { status: 400 });
    }

    const trimmedNombre = nombre.trim();
    if (trimmedNombre.length < 2 || trimmedNombre.length > 50) {
      return NextResponse.json({ error: "El nombre debe tener entre 2 y 50 caracteres" }, { status: 400 });
    }

    if (!VALID_NIVELES.includes(nivel_acceso as typeof VALID_NIVELES[number])) {
      return NextResponse.json({ error: "nivel_acceso inválido. Debe ser uno de: DIRECTIVO, ADMINISTRADOR, CONTRATISTA, OBRERO" }, { status: 400 });
    }

    // Check for duplicate name in same constructora
    const existing = await prisma.rol.findFirst({
      where: { constructora_id: currentUser.constructora_id, nombre: trimmedNombre },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un rol con ese nombre en esta constructora" }, { status: 409 });
    }

    const rol = await prisma.rol.create({
      data: {
        constructora_id: currentUser.constructora_id,
        nombre: trimmedNombre,
        nivel_acceso: nivel_acceso as typeof VALID_NIVELES[number],
      },
    });

    return NextResponse.json(rol, { status: 201 });
  } catch (error) {
    console.error("POST /api/roles", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
