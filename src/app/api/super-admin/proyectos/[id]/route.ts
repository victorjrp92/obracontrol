import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, estado, dias_habiles_semana } = body as {
      nombre?: string;
      estado?: "ACTIVO" | "PAUSADO" | "COMPLETADO" | "ARCHIVADO";
      dias_habiles_semana?: number;
    };

    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    if (nombre !== undefined && nombre.trim().length < 2) {
      return NextResponse.json({ error: "Nombre demasiado corto" }, { status: 400 });
    }

    const updated = await prisma.proyecto.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(estado !== undefined && { estado }),
        ...(dias_habiles_semana !== undefined && { dias_habiles_semana }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/super-admin/proyectos/[id]", error);
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
    const proyecto = await prisma.proyecto.findUnique({ where: { id } });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    await prisma.proyecto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/super-admin/proyectos/[id]", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
