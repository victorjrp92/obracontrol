import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-guard";

// POST /api/super-admin/proyectos/[id]/admins
// body: { usuario_id }
// Asigna un Admin Junior (ADMIN_PROYECTO) al proyecto vía AdminProyectoAccess.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id: proyecto_id } = await params;
    const { usuario_id } = (await req.json()) as { usuario_id?: string };

    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyecto_id },
      select: { id: true, constructora_id: true },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: usuario_id },
      include: { rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (usuario.constructora_id !== proyecto.constructora_id) {
      return NextResponse.json(
        { error: "El usuario debe ser de la misma constructora que el proyecto" },
        { status: 400 },
      );
    }

    if (usuario.rol_ref.nivel_acceso !== "ADMIN_PROYECTO") {
      return NextResponse.json(
        { error: "Solo se puede asignar usuarios con rol Admin Proyecto" },
        { status: 400 },
      );
    }

    const access = await prisma.adminProyectoAccess.upsert({
      where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } },
      update: {},
      create: { usuario_id, proyecto_id, asignado_por: su.id },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("POST /api/super-admin/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/super-admin/proyectos/[id]/admins?usuario_id=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id: proyecto_id } = await params;
    const usuario_id = req.nextUrl.searchParams.get("usuario_id");
    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    await prisma.adminProyectoAccess
      .delete({ where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } } })
      .catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/super-admin/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
