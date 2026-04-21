import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { canManageUsers, isAnyAdmin } from "@/lib/access";

// POST /api/contratistas/agregar — add contratista without Supabase auth
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: {
        constructora: { select: { id: true } },
        rol_ref: { select: { nivel_acceso: true } },
      },
    });
    if (
      !currentUser ||
      !(
        canManageUsers(currentUser.rol_ref.nivel_acceso) ||
        isAnyAdmin(currentUser.rol_ref.nivel_acceso)
      )
    ) {
      return NextResponse.json(
        { error: "Sin permisos para agregar contratistas" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { nombre: rawNombre, email: rawEmail } = body as {
      nombre?: string;
      email?: string;
    };

    if (!rawNombre || !rawEmail) {
      return NextResponse.json(
        { error: "nombre y email son requeridos" },
        { status: 400 },
      );
    }

    const email = rawEmail.trim().toLowerCase();
    const nombre = rawNombre.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }
    if (nombre.length < 2 || nombre.length > 100) {
      return NextResponse.json(
        { error: "El nombre debe tener entre 2 y 100 caracteres" },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con este email" },
        { status: 409 },
      );
    }

    // Find the first CONTRATISTA role in this constructora
    const rolContratista = await prisma.rol.findFirst({
      where: {
        constructora_id: currentUser.constructora_id,
        nivel_acceso: "CONTRATISTA",
      },
    });
    if (!rolContratista) {
      return NextResponse.json(
        { error: "No existe un rol de Contratista en esta constructora" },
        { status: 400 },
      );
    }

    // Create usuario + contratista profile in a transaction
    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email,
          nombre,
          constructora_id: currentUser.constructora_id,
          rol_id: rolContratista.id,
          invitado: false,
        },
      });

      await tx.contratista.create({
        data: {
          usuario_id: usuario.id,
          score_cumplimiento: 80,
          score_calidad: 80,
          score_velocidad_correccion: 80,
          score_total: 80,
        },
      });

      return usuario;
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("POST /api/contratistas/agregar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
