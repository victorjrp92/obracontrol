import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin, isSuperAdmin } from "@/lib/access";
import { generarClienteToken } from "@/lib/data-cliente";

// Enlace de SOLO LECTURA que el dueño comparte con su cliente para ver el avance.
// Solo el dueño/admin de la cuenta (ADMIN_GENERAL de esa constructora; en cuenta
// personal Contratista B2C es el propio dueño) puede generar/revocar.
// Máximo 1 token activo por proyecto.

/** Valida sesión + tenant + rol. Devuelve el usuario o un NextResponse de error. */
async function autorizar(proyectoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const currentUser = await prisma.usuario.findUnique({
    where: { email: user.email! },
    select: {
      id: true,
      constructora_id: true,
      rol_ref: { select: { nivel_acceso: true } },
    },
  });
  if (!currentUser) {
    return { error: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  }

  const nivel = currentUser.rol_ref.nivel_acceso;
  if (!isGeneralAdmin(nivel) && !isSuperAdmin(nivel)) {
    return {
      error: NextResponse.json(
        { error: "Solo el dueño de la cuenta puede gestionar el enlace del cliente" },
        { status: 403 },
      ),
    };
  }

  // Tenant-safe: el proyecto debe pertenecer a la constructora del usuario.
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: currentUser.constructora_id },
    select: { id: true },
  });
  if (!proyecto) {
    return { error: NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 }) };
  }

  return { user: currentUser };
}

// GET — devuelve el token activo del proyecto (o null) para mostrar el enlace.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: proyectoId } = await params;
    const auth = await autorizar(proyectoId);
    if (auth.error) return auth.error;

    const activo = await prisma.clienteAccesoToken.findFirst({
      where: { proyecto_id: proyectoId, activo: true },
      orderBy: { created_at: "desc" },
      select: { token: true, created_at: true },
    });

    return NextResponse.json({ token: activo?.token ?? null, created_at: activo?.created_at ?? null });
  } catch (error) {
    console.error("GET /api/proyectos/[id]/cliente-token", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — crea (o devuelve) el token activo del proyecto.
// Si ya hay uno activo lo devuelve (idempotente). `?regenerar=1` invalida el
// anterior y crea uno nuevo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: proyectoId } = await params;
    const auth = await autorizar(proyectoId);
    if (auth.error) return auth.error;

    const regenerar = req.nextUrl.searchParams.get("regenerar") === "1";

    if (!regenerar) {
      const existente = await prisma.clienteAccesoToken.findFirst({
        where: { proyecto_id: proyectoId, activo: true },
        orderBy: { created_at: "desc" },
        select: { token: true, created_at: true },
      });
      if (existente) {
        return NextResponse.json({ token: existente.token, created_at: existente.created_at });
      }
    }

    // Regenerar (o crear el primero): invalida cualquier token activo previo
    // y crea uno nuevo, manteniendo máximo 1 activo por proyecto.
    const nuevo = await prisma.$transaction(async (tx) => {
      await tx.clienteAccesoToken.updateMany({
        where: { proyecto_id: proyectoId, activo: true },
        data: { activo: false },
      });
      return tx.clienteAccesoToken.create({
        data: { proyecto_id: proyectoId, token: generarClienteToken() },
        select: { token: true, created_at: true },
      });
    });

    return NextResponse.json(nuevo, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/cliente-token", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — revoca (desactiva) el/los token(s) activo(s) del proyecto.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: proyectoId } = await params;
    const auth = await autorizar(proyectoId);
    if (auth.error) return auth.error;

    const res = await prisma.clienteAccesoToken.updateMany({
      where: { proyecto_id: proyectoId, activo: true },
      data: { activo: false },
    });

    return NextResponse.json({ ok: true, revocados: res.count });
  } catch (error) {
    console.error("DELETE /api/proyectos/[id]/cliente-token", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
