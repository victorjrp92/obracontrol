import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/obreros/[id] — update obrero (extend date, toggle active)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Verify obrero belongs to this contratista
    const obrero = await prisma.obrero.findUnique({
      where: { id },
      select: { contratista_id: true },
    });

    if (!obrero || obrero.contratista_id !== usuario.id) {
      return NextResponse.json(
        { error: "Obrero no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { fecha_expiracion, activo } = body as {
      fecha_expiracion?: string;
      activo?: boolean;
    };

    const data: Record<string, unknown> = {};

    if (fecha_expiracion !== undefined) {
      const fecha = new Date(fecha_expiracion);
      if (isNaN(fecha.getTime())) {
        return NextResponse.json(
          { error: "Fecha invalida" },
          { status: 400 }
        );
      }
      data.fecha_expiracion = fecha;
    }

    if (activo !== undefined) {
      data.activo = activo;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const updated = await prisma.obrero.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/obreros/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/obreros/[id] — delete obrero (only if no evidencias)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Verify obrero belongs to this contratista
    const obrero = await prisma.obrero.findUnique({
      where: { id },
      select: {
        contratista_id: true,
        _count: { select: { evidencias: true } },
      },
    });

    if (!obrero || obrero.contratista_id !== usuario.id) {
      return NextResponse.json(
        { error: "Obrero no encontrado" },
        { status: 404 }
      );
    }

    if (obrero._count.evidencias > 0) {
      return NextResponse.json(
        {
          error:
            "No se puede eliminar un obrero que ya tiene evidencias registradas. Desactivalo en su lugar.",
        },
        { status: 400 }
      );
    }

    await prisma.obrero.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/obreros/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
