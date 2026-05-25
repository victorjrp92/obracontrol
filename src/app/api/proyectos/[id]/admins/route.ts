import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin, isProjectAdmin, checkAdminProjectPermission } from "@/lib/access";

interface PermisosPayload {
  can_edit_project?: boolean;
  can_assign_contractors?: boolean;
  can_manage_team?: boolean;
  can_approve_tasks?: boolean;
}

function sanitizePermisos(input: PermisosPayload | undefined) {
  return {
    can_edit_project: Boolean(input?.can_edit_project),
    can_assign_contractors: Boolean(input?.can_assign_contractors),
    can_manage_team: Boolean(input?.can_manage_team),
    can_approve_tasks: input?.can_approve_tasks === undefined ? true : Boolean(input.can_approve_tasks),
  };
}

// POST /api/proyectos/[id]/admins
// ADMIN_GENERAL asigna Admin Junior a un proyecto (con permisos granulares).
// Un ADMIN_PROYECTO con can_manage_team puede también gestionar admins juniors
// del mismo proyecto (no asignar nuevos: solo el general puede hacerlo).
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
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json(
        { error: "Solo Admin General puede asignar Admin Junior" },
        { status: 403 },
      );
    }

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const body = (await req.json()) as { usuario_id?: string; permisos?: PermisosPayload };
    if (!body.usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id: body.usuario_id, constructora_id: currentUser.constructora_id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado en tu constructora" }, { status: 404 });
    }
    if (usuario.rol_ref.nivel_acceso !== "ADMIN_PROYECTO") {
      return NextResponse.json(
        { error: "Solo se puede asignar usuarios con rol Admin Proyecto" },
        { status: 400 },
      );
    }

    const permisos = sanitizePermisos(body.permisos);

    const access = await prisma.adminProyectoAccess.upsert({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      update: { ...permisos },
      create: {
        usuario_id: body.usuario_id,
        proyecto_id,
        asignado_por: currentUser.id,
        ...permisos,
      },
    });
    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/proyectos/[id]/admins — actualizar permisos de un Admin Junior existente.
// ADMIN_GENERAL o ADMIN_PROYECTO con can_manage_team pueden modificarlos.
export async function PATCH(
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

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Authorization: Admin General, o un Admin Proyecto con can_manage_team.
    if (isProjectAdmin(currentUser.rol_ref.nivel_acceso)) {
      const allowed = await checkAdminProjectPermission(
        currentUser.id,
        proyecto_id,
        "can_manage_team",
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para gestionar el equipo de este proyecto" },
          { status: 403 },
        );
      }
    } else if (!isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = (await req.json()) as { usuario_id?: string; permisos?: PermisosPayload };
    if (!body.usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    // Anti-escalación: un Admin Proyecto NO puede modificar sus propios permisos
    // (de otro modo, can_manage_team le permitiría auto-otorgarse can_edit_project, etc.)
    if (
      isProjectAdmin(currentUser.rol_ref.nivel_acceso) &&
      body.usuario_id === currentUser.id
    ) {
      return NextResponse.json(
        { error: "No puedes modificar tus propios permisos. Pídeselo a un Admin General." },
        { status: 403 },
      );
    }

    const existing = await prisma.adminProyectoAccess.findUnique({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Admin Junior no asignado a este proyecto" }, { status: 404 });
    }

    const permisos = sanitizePermisos(body.permisos);
    const updated = await prisma.adminProyectoAccess.update({
      where: { usuario_id_proyecto_id: { usuario_id: body.usuario_id, proyecto_id } },
      data: permisos,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
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
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Authorization: Admin General o Admin Proyecto con can_manage_team
    if (isProjectAdmin(currentUser.rol_ref.nivel_acceso)) {
      const allowed = await checkAdminProjectPermission(
        currentUser.id,
        proyecto_id,
        "can_manage_team",
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "No tienes permiso para gestionar el equipo de este proyecto" },
          { status: 403 },
        );
      }
    } else if (!isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const usuario_id = req.nextUrl.searchParams.get("usuario_id");
    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    // Anti-escalación: un Admin Proyecto NO puede quitarse a sí mismo del proyecto.
    if (
      isProjectAdmin(currentUser.rol_ref.nivel_acceso) &&
      usuario_id === currentUser.id
    ) {
      return NextResponse.json(
        { error: "No puedes quitarte a ti mismo del proyecto. Pídeselo a un Admin General." },
        { status: 403 },
      );
    }

    try {
      await prisma.adminProyectoAccess.delete({
        where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } },
      });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: "Admin Junior no encontrado en este proyecto" }, { status: 404 });
    }
  } catch (error) {
    console.error("DELETE /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
