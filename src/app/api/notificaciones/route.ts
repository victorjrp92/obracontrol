import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// GET /api/notificaciones — list notifications for current user
// Query params: ?limit=20 &unread=true
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const unreadOnly = searchParams.get("unread") === "true";

    const where = {
      usuario_id: usuario.id,
      ...(unreadOnly ? { leida: false } : {}),
    };

    const [notificaciones, totalNoLeidas] = await Promise.all([
      prisma.notificacion.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
      }),
      prisma.notificacion.count({
        where: { usuario_id: usuario.id, leida: false },
      }),
    ]);

    return NextResponse.json({ notificaciones, totalNoLeidas });
  } catch (error) {
    console.error("GET /api/notificaciones", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/notificaciones — mark notifications as read
// Body: { ids?: string[], all?: boolean }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

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
    const { ids, all } = body as { ids?: string[]; all?: boolean };

    if (all) {
      await prisma.notificacion.updateMany({
        where: { usuario_id: usuario.id, leida: false },
        data: { leida: true },
      });
    } else if (ids && ids.length > 0) {
      await prisma.notificacion.updateMany({
        where: { usuario_id: usuario.id, id: { in: ids } },
        data: { leida: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/notificaciones", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
