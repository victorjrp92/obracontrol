import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin, isSuperAdmin } from "@/lib/access";

const ID_RE = /^[a-z0-9]{20,30}$/;

/**
 * PATCH /api/proyectos/[id]/gastos/[gastoId] — aprobar o rechazar un gasto.
 *
 * Body: { estado: "APROBADO" | "RECHAZADO" }
 * Permisos: SOLO el dueño/admin general de la constructora (en B2C el
 * propietario es ADMIN_GENERAL). Super admin también. El obrero/contratista
 * que registra NO puede aprobar.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gastoId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id, gastoId } = await params;

    if (!ID_RE.test(gastoId)) {
      return NextResponse.json({ error: "gastoId formato inválido" }, { status: 400 });
    }

    // Solo el dueño/admin general (o super admin) puede aprobar/rechazar.
    const nivel = currentUser.rol_ref.nivel_acceso;
    if (!isGeneralAdmin(nivel) && !isSuperAdmin(nivel)) {
      return NextResponse.json(
        { error: "Solo el dueño puede aprobar o rechazar gastos" },
        { status: 403 },
      );
    }

    // Tenant: proyecto de la constructora del usuario.
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
      select: { id: true },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const body = (await req.json()) as { estado?: string };
    if (body.estado !== "APROBADO" && body.estado !== "RECHAZADO") {
      return NextResponse.json(
        { error: "estado debe ser APROBADO o RECHAZADO" },
        { status: 400 },
      );
    }

    // El gasto debe pertenecer a este proyecto (no cross-tenant ni cross-proyecto).
    const gasto = await prisma.gasto.findFirst({
      where: { id: gastoId, proyecto_id },
      select: { id: true, estado: true, registrado_por: true },
    });
    if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

    if (gasto.estado !== "REGISTRADO") {
      return NextResponse.json(
        { error: `Este gasto ya está ${gasto.estado.toLowerCase()}` },
        { status: 409 },
      );
    }

    const actualizado = await prisma.gasto.update({
      where: { id: gastoId },
      data: { estado: body.estado, aprobado_por: currentUser.id },
    });

    return NextResponse.json(actualizado);
  } catch (err) {
    console.error("PATCH /api/proyectos/[id]/gastos/[gastoId]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
