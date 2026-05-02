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
    const { nombre, nit, ciudad, direccion, telefono, sitio_web, plan_suscripcion } = body as {
      nombre?: string;
      nit?: string | null;
      ciudad?: string | null;
      direccion?: string | null;
      telefono?: string | null;
      sitio_web?: string | null;
      plan_suscripcion?: "OBRA" | "PROYECTO" | "EMPRESA";
    };

    const constructora = await prisma.constructora.findUnique({ where: { id } });
    if (!constructora) {
      return NextResponse.json({ error: "Constructora no encontrada" }, { status: 404 });
    }

    if (nombre !== undefined && nombre.trim().length < 2) {
      return NextResponse.json({ error: "Nombre demasiado corto" }, { status: 400 });
    }

    if (nit && nit !== constructora.nit) {
      const existing = await prisma.constructora.findUnique({ where: { nit } });
      if (existing) {
        return NextResponse.json({ error: "Ya existe una constructora con ese NIT" }, { status: 409 });
      }
    }

    const updated = await prisma.constructora.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(nit !== undefined && { nit: nit || null }),
        ...(ciudad !== undefined && { ciudad: ciudad || null }),
        ...(direccion !== undefined && { direccion: direccion || null }),
        ...(telefono !== undefined && { telefono: telefono || null }),
        ...(sitio_web !== undefined && { sitio_web: sitio_web || null }),
        ...(plan_suscripcion !== undefined && { plan_suscripcion }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/super-admin/constructoras/[id]", error);
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

    const constructora = await prisma.constructora.findUnique({
      where: { id },
      select: { id: true, nombre: true },
    });
    if (!constructora) {
      return NextResponse.json({ error: "Constructora no encontrada" }, { status: 404 });
    }

    if (constructora.nombre === "Sistema Seiricon") {
      return NextResponse.json(
        { error: "No se puede eliminar la constructora-host del sistema" },
        { status: 400 },
      );
    }

    // Cascade en el schema borra: proyectos → edificios → ... → tareas, usuarios,
    // roles, obreros (todos con onDelete: Cascade vía constructora_id).
    await prisma.constructora.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/super-admin/constructoras/[id]", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
