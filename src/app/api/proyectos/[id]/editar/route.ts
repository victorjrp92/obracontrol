import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/proyectos/[id]/editar — edit project (requires admin password re-confirmation)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, email: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || currentUser.rol_ref.nivel_acceso !== "ADMINISTRADOR") {
      return NextResponse.json({ error: "Solo administradores pueden editar proyectos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { password, cambios } = body as {
      password: string;
      cambios: {
        nombre?: string;
        dias_habiles_semana?: number;
        fecha_inicio?: string | null;
        fecha_fin_estimada?: string | null;
        estado?: string;
      };
    };

    if (!password) {
      return NextResponse.json({ error: "Se requiere la contraseña de administrador" }, { status: 400 });
    }

    // Verify password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
    }

    // Fetch current project
    const proyecto = await prisma.proyecto.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (!cambios || Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
    }

    // Build update data and audit log entries
    const updateData: Record<string, unknown> = {};
    const auditEntries: { campo: string; valor_anterior: string | null; valor_nuevo: string | null }[] = [];

    if (cambios.nombre !== undefined && cambios.nombre !== proyecto.nombre) {
      updateData.nombre = cambios.nombre;
      auditEntries.push({ campo: "nombre", valor_anterior: proyecto.nombre, valor_nuevo: cambios.nombre });
    }
    if (cambios.dias_habiles_semana !== undefined && cambios.dias_habiles_semana !== proyecto.dias_habiles_semana) {
      updateData.dias_habiles_semana = cambios.dias_habiles_semana;
      auditEntries.push({ campo: "dias_habiles_semana", valor_anterior: String(proyecto.dias_habiles_semana), valor_nuevo: String(cambios.dias_habiles_semana) });
    }
    if (cambios.fecha_inicio !== undefined) {
      const newVal = cambios.fecha_inicio ? new Date(cambios.fecha_inicio) : null;
      const oldVal = proyecto.fecha_inicio;
      if (newVal?.toISOString() !== oldVal?.toISOString()) {
        updateData.fecha_inicio = newVal;
        auditEntries.push({ campo: "fecha_inicio", valor_anterior: oldVal?.toISOString() ?? null, valor_nuevo: newVal?.toISOString() ?? null });
      }
    }
    if (cambios.fecha_fin_estimada !== undefined) {
      const newVal = cambios.fecha_fin_estimada ? new Date(cambios.fecha_fin_estimada) : null;
      const oldVal = proyecto.fecha_fin_estimada;
      if (newVal?.toISOString() !== oldVal?.toISOString()) {
        updateData.fecha_fin_estimada = newVal;
        auditEntries.push({ campo: "fecha_fin_estimada", valor_anterior: oldVal?.toISOString() ?? null, valor_nuevo: newVal?.toISOString() ?? null });
      }
    }
    if (cambios.estado !== undefined && cambios.estado !== proyecto.estado) {
      updateData.estado = cambios.estado;
      auditEntries.push({ campo: "estado", valor_anterior: proyecto.estado, valor_nuevo: cambios.estado });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No hay cambios efectivos" }, { status: 400 });
    }

    // Apply changes + create audit log entries in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.proyecto.update({ where: { id }, data: updateData });
      for (const entry of auditEntries) {
        await tx.auditLog.create({
          data: {
            proyecto_id: id,
            usuario_id: currentUser.id,
            accion: "EDITAR_PROYECTO",
            campo: entry.campo,
            valor_anterior: entry.valor_anterior,
            valor_nuevo: entry.valor_nuevo,
          },
        });
      }
    });

    return NextResponse.json({ ok: true, cambios: auditEntries.length });
  } catch (err) {
    console.error("PATCH /api/proyectos/[id]/editar", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// GET /api/proyectos/[id]/editar — get audit log
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !["ADMINISTRADOR", "DIRECTIVO"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const logs = await prisma.auditLog.findMany({
      where: { proyecto_id: id, proyecto: { constructora_id: currentUser.constructora_id } },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error("GET /api/proyectos/[id]/editar", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
