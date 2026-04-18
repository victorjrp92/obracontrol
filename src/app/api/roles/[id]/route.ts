import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin } from "@/lib/access";

const VALID_NIVELES = ["DIRECTIVO", "ADMIN_GENERAL", "ADMIN_PROYECTO", "CONTRATISTA", "OBRERO"] as const;

// PATCH /api/roles/[id] — edit a role's nombre or nivel_acceso
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
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { nombre, nivel_acceso } = body as { nombre?: string; nivel_acceso?: string };

    if (!nombre && !nivel_acceso) {
      return NextResponse.json({ error: "Se requiere al menos nombre o nivel_acceso" }, { status: 400 });
    }

    if (nivel_acceso && !VALID_NIVELES.includes(nivel_acceso as typeof VALID_NIVELES[number])) {
      return NextResponse.json({ error: "nivel_acceso inválido" }, { status: 400 });
    }

    if (nombre !== undefined) {
      const trimmed = nombre.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        return NextResponse.json({ error: "El nombre debe tener entre 2 y 50 caracteres" }, { status: 400 });
      }
    }

    // Verify role belongs to this constructora
    const rol = await prisma.rol.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
    });
    if (!rol) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

    // Check for name conflict with another role in the same constructora
    if (nombre !== undefined) {
      const trimmedNombre = nombre.trim();
      const conflict = await prisma.rol.findFirst({
        where: {
          constructora_id: currentUser.constructora_id,
          nombre: trimmedNombre,
          id: { not: id },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "Ya existe un rol con ese nombre en esta constructora" }, { status: 409 });
      }
    }

    const updated = await prisma.rol.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(nivel_acceso !== undefined && { nivel_acceso: nivel_acceso as typeof VALID_NIVELES[number] }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/roles/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/roles/[id] — delete a role (only if no users assigned)
export async function DELETE(
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
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Verify role belongs to this constructora
    const rol = await prisma.rol.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!rol) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

    if (rol._count.usuarios > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un rol con usuarios asignados" },
        { status: 409 }
      );
    }

    await prisma.rol.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/roles/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
