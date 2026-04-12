import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// GET /api/proyectos — lista proyectos de la constructora del usuario
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const proyectos = await prisma.proyecto.findMany({
      where: { constructora_id: usuario.constructora_id },
      include: {
        edificios: { include: { pisos: { include: { unidades: true } } } },
        fases: true,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(proyectos);
  } catch (error) {
    console.error("GET /api/proyectos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/proyectos — crear nuevo proyecto
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || !["ADMINISTRADOR"].includes(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, subtipo, dias_habiles_semana, fecha_inicio, fecha_fin_estimada, ubicacion_lat, ubicacion_lng } = body;

    if (!nombre || !subtipo) {
      return NextResponse.json({ error: "nombre y subtipo son requeridos" }, { status: 400 });
    }

    const proyecto = await prisma.proyecto.create({
      data: {
        constructora_id: usuario.constructora_id,
        nombre,
        subtipo,
        dias_habiles_semana: dias_habiles_semana ?? 5,
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
        fecha_fin_estimada: fecha_fin_estimada ? new Date(fecha_fin_estimada) : null,
        ubicacion_lat,
        ubicacion_lng,
      },
    });

    return NextResponse.json(proyecto, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
