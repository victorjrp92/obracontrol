import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-guard";

const VALID_NIVELES = [
  "DIRECTIVO",
  "ADMIN_GENERAL",
  "ADMIN_PROYECTO",
  "CONTRATISTA",
  "OBRERO",
  // SUPER_ADMIN intencionalmente excluído: solo se asigna por seed.
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, nivel_acceso } = body as { nombre?: string; nivel_acceso?: string };

    const rol = await prisma.rol.findUnique({ where: { id } });
    if (!rol) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

    if (rol.nivel_acceso === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No se puede modificar el rol Super Admin" },
        { status: 400 },
      );
    }

    if (nombre !== undefined && (nombre.trim().length < 2 || nombre.trim().length > 50)) {
      return NextResponse.json({ error: "Nombre debe tener 2-50 caracteres" }, { status: 400 });
    }

    if (nivel_acceso !== undefined && !VALID_NIVELES.includes(nivel_acceso as never)) {
      return NextResponse.json({ error: "nivel_acceso inválido" }, { status: 400 });
    }

    if (nombre !== undefined && nombre.trim() !== rol.nombre) {
      const conflict = await prisma.rol.findFirst({
        where: {
          constructora_id: rol.constructora_id,
          nombre: nombre.trim(),
          id: { not: id },
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "Ya existe un rol con ese nombre" }, { status: 409 });
      }
    }

    const updated = await prisma.rol.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(nivel_acceso !== undefined && { nivel_acceso: nivel_acceso as never }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/super-admin/roles/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id } = await params;

    const rol = await prisma.rol.findUnique({
      where: { id },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!rol) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

    if (rol.nivel_acceso === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "No se puede eliminar el rol Super Admin" },
        { status: 400 },
      );
    }

    if (rol._count.usuarios > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: ${rol._count.usuarios} usuario(s) tienen este rol` },
        { status: 409 },
      );
    }

    await prisma.rol.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/super-admin/roles/[id]", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
