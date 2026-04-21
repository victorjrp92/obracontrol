import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/access";

// PATCH /api/usuarios/[id] — change role and/or project assignments
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
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !canManageUsers(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rol_id, proyectos_asignados, nombre, email } = body as {
      rol_id?: string;
      proyectos_asignados?: string[];
      nombre?: string;
      email?: string;
    };

    if (!rol_id && proyectos_asignados === undefined && !nombre && !email) {
      return NextResponse.json({ error: "rol_id, proyectos_asignados, nombre o email es requerido" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Only allow nombre/email edits for uninvited users
    if ((nombre || email) && target.invitado) {
      return NextResponse.json({ error: "Solo se puede editar nombre/email de usuarios sin invitación" }, { status: 400 });
    }

    // Validate nombre/email if provided
    if (nombre !== undefined) {
      const trimmed = nombre.trim();
      if (trimmed.length < 2 || trimmed.length > 100) {
        return NextResponse.json({ error: "El nombre debe tener entre 2 y 100 caracteres" }, { status: 400 });
      }
    }
    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Email no válido" }, { status: 400 });
      }
      // Check if new email already exists (and it's not the same user)
      if (trimmed !== target.email) {
        const existing = await prisma.usuario.findUnique({ where: { email: trimmed } });
        if (existing) {
          return NextResponse.json({ error: "Ya existe un usuario con este email" }, { status: 409 });
        }
      }
    }

    let effectiveNivel = target.rol_ref.nivel_acceso;

    if (rol_id) {
      const rol = await prisma.rol.findFirst({
        where: { id: rol_id, constructora_id: currentUser.constructora_id },
      });
      if (!rol) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      effectiveNivel = rol.nivel_acceso;
    }

    // If the resulting role is ADMIN_PROYECTO, we need a non-empty project list.
    if (effectiveNivel === "ADMIN_PROYECTO") {
      const nextList =
        proyectos_asignados !== undefined
          ? proyectos_asignados
          : (await prisma.adminProyectoAccess.findMany({
              where: { usuario_id: id },
              select: { proyecto_id: true },
            })).map((a) => a.proyecto_id);

      if (!Array.isArray(nextList) || nextList.length === 0) {
        return NextResponse.json(
          { error: "Un Admin Proyecto debe tener al menos un proyecto asignado" },
          { status: 400 },
        );
      }
    }

    // Validate proyectos_asignados belong to the constructora
    if (Array.isArray(proyectos_asignados) && proyectos_asignados.length > 0) {
      const proyectosDb = await prisma.proyecto.findMany({
        where: { id: { in: proyectos_asignados }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (proyectosDb.length !== proyectos_asignados.length) {
        return NextResponse.json(
          { error: "Algunos proyectos no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // Build update data for nombre/email if provided (uninvited users only)
      const updateData: { rol_id?: string; nombre?: string; email?: string } = {};
      if (rol_id) updateData.rol_id = rol_id;
      if (nombre && !target.invitado) updateData.nombre = nombre.trim();
      if (email && !target.invitado) updateData.email = email.trim().toLowerCase();

      if (Object.keys(updateData).length > 0) {
        await tx.usuario.update({ where: { id }, data: updateData });
      }

      if (rol_id) {

        // Ensure contratista row if switching to CONTRATISTA
        if (effectiveNivel === "CONTRATISTA") {
          const existing = await tx.contratista.findUnique({ where: { usuario_id: id } });
          if (!existing) {
            await tx.contratista.create({
              data: {
                usuario_id: id,
                score_cumplimiento: 80,
                score_calidad: 80,
                score_velocidad_correccion: 80,
                score_total: 80,
              },
            });
          }
        }
      }

      // Sync project assignments:
      // - If target role is ADMIN_PROYECTO and a list was given, replace the set.
      // - If target role is not ADMIN_PROYECTO, clear any existing assignments.
      if (effectiveNivel === "ADMIN_PROYECTO" && Array.isArray(proyectos_asignados)) {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
        if (proyectos_asignados.length > 0) {
          await tx.adminProyectoAccess.createMany({
            data: proyectos_asignados.map((pid) => ({
              usuario_id: id,
              proyecto_id: pid,
              asignado_por: currentUser.id,
            })),
            skipDuplicates: true,
          });
        }
      } else if (effectiveNivel !== "ADMIN_PROYECTO") {
        await tx.adminProyectoAccess.deleteMany({ where: { usuario_id: id } });
      }
    });

    const updated = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: true, proyectos_administrados: { select: { proyecto_id: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
