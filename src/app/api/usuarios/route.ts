import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { invitationEmailHtml } from "@/lib/email-templates/invitation";
import { getRolLabel } from "@/lib/permissions";

// GET /api/usuarios — list users of the constructora
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !["ADMINISTRADOR", "DIRECTIVO"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const usuarios = await prisma.usuario.findMany({
      where: { constructora_id: currentUser.constructora_id },
      select: { id: true, email: true, nombre: true, rol_ref: { select: { nombre: true, nivel_acceso: true } }, created_at: true },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error("GET /api/usuarios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/usuarios �� invite a new user
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: { constructora: { select: { id: true, nombre: true } }, rol_ref: true },
    });
    if (!currentUser || !["ADMINISTRADOR", "DIRECTIVO"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para invitar usuarios" }, { status: 403 });
    }

    const body = await req.json();
    const { email, nombre, rol_id } = body;

    if (!email || !nombre || !rol_id) {
      return NextResponse.json({ error: "email, nombre y rol_id son requeridos" }, { status: 400 });
    }

    // Verify the rol exists and belongs to this constructora
    const rol = await prisma.rol.findFirst({
      where: { id: rol_id, constructora_id: currentUser.constructora_id },
    });
    if (!rol) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con este email" }, { status: 409 });
    }

    const tempPassword = `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json({ error: `Error creando cuenta: ${authError.message}` }, { status: 500 });
    }

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        constructora_id: currentUser.constructora_id,
        rol_id: rol.id,
      },
    });

    if (rol.nivel_acceso === "CONTRATISTA") {
      await prisma.contratista.create({
        data: {
          usuario_id: nuevoUsuario.id,
          score_cumplimiento: 80,
          score_calidad: 80,
          score_velocidad_correccion: 80,
          score_total: 80,
        },
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
    try {
      await sendEmail({
        to: email,
        subject: `Te han invitado a ${currentUser.constructora.nombre} en Seiricon`,
        html: invitationEmailHtml({
          nombreInvitado: nombre,
          nombreConstructora: currentUser.constructora.nombre,
          rol: getRolLabel(rol.nombre),
          loginUrl: `${siteUrl}/login`,
          password: tempPassword,
        }),
      });
    } catch {
      console.error("Failed to send invitation email");
    }

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    console.error("POST /api/usuarios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
