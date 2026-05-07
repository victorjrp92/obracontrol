import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  canManageTaskPrice,
  getAccessibleProjectIds,
  canAccessProject,
} from "@/lib/access";

/**
 * PATCH /api/tareas/[id]/precio
 * body: { precio: number | null }
 *
 * Permisos:
 * - SUPER_ADMIN, ADMIN_GENERAL, DIRECTIVO: pueden cambiar precio en cualquier
 *   tarea de su scope.
 * - ADMIN_PROYECTO: solo en proyectos asignados.
 * - CONTRATISTA: solo en tareas que le pertenecen (asignado_a = caller).
 * - OBRERO: bloqueado por canManageTaskPrice.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const caller = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!caller) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (!canManageTaskPrice(caller.rol_ref.nivel_acceso)) {
      return NextResponse.json(
        { error: "Tu rol no puede editar precios de tareas" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const tarea = await prisma.tarea.findUnique({
      where: { id },
      include: {
        espacio: {
          select: {
            unidad: {
              select: {
                piso: {
                  select: { edificio: { select: { proyecto: { select: { id: true, constructora_id: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    if (!tarea) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

    const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;

    // Tenant isolation
    if (caller.rol_ref.nivel_acceso !== "SUPER_ADMIN" && proyecto.constructora_id !== caller.constructora_id) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    // Contratista solo edita SUS tareas
    if (caller.rol_ref.nivel_acceso === "CONTRATISTA" && tarea.asignado_a !== caller.id) {
      return NextResponse.json(
        { error: "Solo puedes editar precios de tus propias tareas" },
        { status: 403 },
      );
    }

    // Admin Proyecto solo en proyectos asignados
    if (caller.rol_ref.nivel_acceso === "ADMIN_PROYECTO") {
      const accessible = await getAccessibleProjectIds(
        caller.id,
        caller.constructora_id,
        caller.rol_ref.nivel_acceso,
      );
      if (!canAccessProject(accessible, proyecto.id)) {
        return NextResponse.json({ error: "Proyecto fuera de tu alcance" }, { status: 403 });
      }
    }

    const body = await req.json();
    const { precio } = body as { precio?: number | null };

    if (precio !== null && precio !== undefined) {
      if (typeof precio !== "number" || !isFinite(precio) || precio < 0) {
        return NextResponse.json(
          { error: "El precio debe ser un número ≥ 0" },
          { status: 400 },
        );
      }
      if (precio > 1_000_000_000) {
        return NextResponse.json(
          { error: "Precio fuera de rango (máx 1.000.000.000)" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.tarea.update({
      where: { id },
      data: { precio: precio === null ? null : precio },
      select: { id: true, precio: true, numero_registro: true, nombre: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        proyecto_id: proyecto.id,
        usuario_id: caller.id,
        accion: "EDITAR_PRECIO_TAREA",
        campo: "precio",
        valor_anterior: tarea.precio != null ? String(tarea.precio) : null,
        valor_nuevo: updated.precio != null ? String(updated.precio) : null,
      },
    }).catch(() => null);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/tareas/[id]/precio", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
