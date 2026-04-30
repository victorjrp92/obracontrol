import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin } from "@/lib/access";

// POST /api/proyectos/[id]/admins
// Solo ADMIN_GENERAL puede asignar Admin Junior a sus proyectos.
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

    const { usuario_id } = (await req.json()) as { usuario_id?: string };
    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    const usuario = await prisma.usuario.findFirst({
      where: { id: usuario_id, constructora_id: currentUser.constructora_id },
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

    const access = await prisma.adminProyectoAccess.upsert({
      where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } },
      update: {},
      create: { usuario_id, proyecto_id, asignado_por: currentUser.id },
    });
    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/admins", error);
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
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id: proyecto_id } = await params;
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const usuario_id = req.nextUrl.searchParams.get("usuario_id");
    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id es requerido" }, { status: 400 });
    }

    await prisma.adminProyectoAccess
      .delete({ where: { usuario_id_proyecto_id: { usuario_id, proyecto_id } } })
      .catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/proyectos/[id]/admins", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
