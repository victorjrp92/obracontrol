import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers } from "@/lib/access";

// GET /api/roles/[id]/usuarios — list users assigned to a role
export async function GET(
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
    if (!currentUser || !canManageUsers(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    // Verify the role belongs to the caller's constructora
    const rol = await prisma.rol.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
    });
    if (!rol) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });

    const usuarios = await prisma.usuario.findMany({
      where: {
        rol_id: id,
        constructora_id: currentUser.constructora_id,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        created_at: true,
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(usuarios);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
