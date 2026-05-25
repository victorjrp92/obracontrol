import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin, isProjectAdmin, checkAdminProjectPermission } from "@/lib/access";

async function requireManageTeam(
  userId: string,
  nivel: string,
  proyectoId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isAnyAdmin(nivel)) {
    return { ok: false, status: 403, error: "Solo administradores pueden gestionar personas" };
  }
  if (isProjectAdmin(nivel)) {
    const allowed = await checkAdminProjectPermission(userId, proyectoId, "can_manage_team");
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "No tienes permiso para gestionar el equipo de este proyecto",
      };
    }
  }
  return { ok: true };
}

// GET /api/proyectos/[id]/personas
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

    const { id: proyecto_id } = await params;

    // Verify project belongs to user's constructora
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Verify user can access the project
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso al proyecto" }, { status: 403 });
    }

    const personas = await prisma.personaExternaProyecto.findMany({
      where: { proyecto_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(personas);
  } catch (error) {
    console.error("GET /api/proyectos/[id]/personas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/proyectos/[id]/personas
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

    const { id: proyecto_id } = await params;

    // Verify project belongs to user's constructora
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Verify user can access the project
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso al proyecto" }, { status: 403 });
    }

    // Only admins (and project-admins with can_manage_team) can add people
    const perm = await requireManageTeam(
      currentUser.id,
      currentUser.rol_ref.nivel_acceso,
      proyecto_id,
    );
    if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

    const body = (await req.json()) as {
      nombre?: string;
      cargo?: string;
      telefono?: string;
      email?: string;
    };

    if (!body.nombre || body.nombre.trim().length === 0) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }
    if (body.nombre.trim().length > 100) {
      return NextResponse.json({ error: "Nombre max 100 caracteres" }, { status: 400 });
    }
    if (body.cargo && body.cargo.trim().length > 100) {
      return NextResponse.json({ error: "Cargo max 100 caracteres" }, { status: 400 });
    }
    if (body.telefono && body.telefono.trim().length > 30) {
      return NextResponse.json({ error: "Telefono max 30 caracteres" }, { status: 400 });
    }
    if (body.email && body.email.trim().length > 100) {
      return NextResponse.json({ error: "Email max 100 caracteres" }, { status: 400 });
    }

    const persona = await prisma.personaExternaProyecto.create({
      data: {
        proyecto_id,
        nombre: body.nombre.trim(),
        cargo: body.cargo?.trim() || null,
        telefono: body.telefono?.trim() || null,
        email: body.email?.trim() || null,
      },
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/personas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/proyectos/[id]/personas
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
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id } = await params;

    // Verify project belongs to user's constructora
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Verify user can access the project
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso al proyecto" }, { status: 403 });
    }

    // Only admins (and project-admins with can_manage_team) can remove people
    const perm = await requireManageTeam(
      currentUser.id,
      currentUser.rol_ref.nivel_acceso,
      proyecto_id,
    );
    if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

    const body = (await req.json()) as { id?: string; password?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id de persona es requerido" }, { status: 400 });
    }
    if (!body.password) {
      return NextResponse.json({ error: "Contraseña es requerida para confirmar" }, { status: 400 });
    }

    // Confirm password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
    }

    // Verify the persona belongs to this project
    const persona = await prisma.personaExternaProyecto.findFirst({
      where: { id: body.id, proyecto_id },
    });
    if (!persona) {
      return NextResponse.json({ error: "Persona no encontrada en este proyecto" }, { status: 404 });
    }

    await prisma.personaExternaProyecto.delete({ where: { id: body.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/proyectos/[id]/personas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
