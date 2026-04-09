import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/usuarios/[id] — change role
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
      select: { constructora_id: true, rol: true },
    });
    if (!currentUser || !["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { rol } = body;

    const validRoles = ["ADMIN", "JEFE_OPERACIONES", "COORDINADOR", "ASISTENTE", "AUXILIAR", "CONTRATISTA_INSTALADOR", "CONTRATISTA_LUSTRADOR"];
    if (!rol || !validRoles.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const target = await prisma.usuario.findUnique({ where: { id } });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data: { rol: rol as never },
    });

    if (rol === "CONTRATISTA_INSTALADOR" || rol === "CONTRATISTA_LUSTRADOR") {
      const existing = await prisma.contratista.findUnique({ where: { usuario_id: id } });
      if (!existing) {
        await prisma.contratista.create({
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/usuarios/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
