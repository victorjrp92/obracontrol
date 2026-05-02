import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// PATCH: edit name, email or rol_id (any user, any constructora)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, email, rol_id } = body as {
      nombre?: string;
      email?: string;
      rol_id?: string;
    };

    const target = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: true },
    });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (nombre !== undefined && nombre.trim().length < 2) {
      return NextResponse.json({ error: "Nombre demasiado corto" }, { status: 400 });
    }

    if (email !== undefined) {
      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Email inválido" }, { status: 400 });
      }
      if (trimmed !== target.email) {
        const exists = await prisma.usuario.findUnique({ where: { email: trimmed } });
        if (exists) return NextResponse.json({ error: "Email ya usado" }, { status: 409 });
      }
    }

    if (rol_id !== undefined) {
      // El rol debe pertenecer a la misma constructora del usuario
      const rol = await prisma.rol.findFirst({
        where: { id: rol_id, constructora_id: target.constructora_id },
      });
      if (!rol) {
        return NextResponse.json(
          { error: "El rol debe pertenecer a la constructora del usuario" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(rol_id !== undefined && { rol_id }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/super-admin/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE: remove user from Supabase auth and from Postgres.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id } = await params;

    if (id === su.id) {
      return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Borrar en Supabase auth (best-effort: si no existe, sigue de largo)
    try {
      const sa = getSupabaseAdmin();
      const { data: list } = await sa.auth.admin.listUsers();
      const authUser = list?.users.find((u) => u.email === target.email);
      if (authUser) await sa.auth.admin.deleteUser(authUser.id);
    } catch (e) {
      console.warn("No se pudo borrar el auth user en Supabase:", e);
    }

    await prisma.usuario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/super-admin/usuarios/[id]", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
