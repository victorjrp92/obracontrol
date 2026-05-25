import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isAnyAdmin, isProjectAdmin, checkAdminProjectPermission } from "@/lib/access";

const MAX_REASIGNACION = 2000;
const ID_RE = /^[a-z0-9]{20,30}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Solo administradores pueden reasignar" }, { status: 403 });
    }

    const { id: proyecto_id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Granular: ADMIN_PROYECTO needs can_assign_contractors on this project.
    if (isProjectAdmin(currentUser.rol_ref.nivel_acceso)) {
      const allowed = await checkAdminProjectPermission(
        currentUser.id,
        proyecto_id,
        "can_assign_contractors",
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para reasignar contratistas en este proyecto" },
          { status: 403 },
        );
      }
    }

    const body = (await req.json()) as {
      contratista_anterior_id?: string;
      contratista_nuevo_id?: string | null;
      password?: string;
      motivo?: string;
    };

    if (typeof body.password !== "string" || !body.password || body.password.length > 128) {
      return NextResponse.json({ error: "Contraseña requerida (max 128 caracteres)" }, { status: 400 });
    }
    if (typeof body.contratista_anterior_id !== "string" || !body.contratista_anterior_id.trim()) {
      return NextResponse.json({ error: "contratista_anterior_id es requerido" }, { status: 400 });
    }
    if (!ID_RE.test(body.contratista_anterior_id)) {
      return NextResponse.json({ error: "contratista_anterior_id formato inválido" }, { status: 400 });
    }
    if (body.contratista_nuevo_id && !ID_RE.test(body.contratista_nuevo_id)) {
      return NextResponse.json({ error: "contratista_nuevo_id formato inválido" }, { status: 400 });
    }
    if (body.motivo && body.motivo.length > 500) {
      return NextResponse.json({ error: "Motivo max 500 caracteres" }, { status: 400 });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
    }

    const anterior = await prisma.usuario.findFirst({
      where: { id: body.contratista_anterior_id, constructora_id: currentUser.constructora_id },
    });
    if (!anterior) return NextResponse.json({ error: "Contratista anterior no encontrado" }, { status: 404 });

    if (body.contratista_nuevo_id) {
      const nuevo = await prisma.usuario.findFirst({
        where: { id: body.contratista_nuevo_id, constructora_id: currentUser.constructora_id },
      });
      if (!nuevo) return NextResponse.json({ error: "Contratista nuevo no encontrado" }, { status: 404 });
    }

    const tareasElegibles = await prisma.tarea.findMany({
      where: {
        asignado_a: body.contratista_anterior_id,
        estado: { in: ["PENDIENTE", "NO_APROBADA"] },
        espacio: {
          unidad: {
            piso: { edificio: { proyecto_id } },
          },
        },
      },
      select: { id: true },
    });

    if (tareasElegibles.length === 0) {
      return NextResponse.json(
        {
          error: "Este contratista no tiene tareas pendientes ni rechazadas para reasignar. Si quieres asignarle tareas nuevas, usa el botón 'Asignar tareas'.",
          reasignadas: 0,
        },
        { status: 400 },
      );
    }

    if (tareasElegibles.length > MAX_REASIGNACION) {
      return NextResponse.json({
        error: `Demasiadas tareas (${tareasElegibles.length}). Máximo ${MAX_REASIGNACION} por operación.`,
      }, { status: 400 });
    }

    const tareaIds = tareasElegibles.map(t => t.id);

    await prisma.$transaction([
      prisma.tarea.updateMany({
        where: { id: { in: tareaIds } },
        data: { asignado_a: body.contratista_nuevo_id ?? null },
      }),
      prisma.reasignacionTarea.createMany({
        data: tareaIds.map(tarea_id => ({
          tarea_id,
          proyecto_id,
          contratista_anterior_id: body.contratista_anterior_id!,
          contratista_nuevo_id: body.contratista_nuevo_id ?? null,
          realizado_por: currentUser.id,
          motivo: body.motivo?.trim() || null,
        })),
      }),
    ]);

    return NextResponse.json({
      ok: true,
      reasignadas: tareaIds.length,
      mensaje: `${tareaIds.length} tareas reasignadas exitosamente`,
    });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/reasignar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: proyecto_id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const reasignaciones = await prisma.reasignacionTarea.findMany({
      where: { proyecto_id },
      include: {
        contratista_anterior: { select: { id: true, nombre: true } },
        contratista_nuevo: { select: { id: true, nombre: true } },
        realizado: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: "desc" },
      take: 100,
    });

    return NextResponse.json(reasignaciones);
  } catch (error) {
    console.error("GET /api/proyectos/[id]/reasignar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
