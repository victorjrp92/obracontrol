import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { invitationEmailHtml } from "@/lib/email-templates/invitation";
import { requireSuperAdmin } from "@/lib/super-admin-guard";

export async function POST(req: NextRequest) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const { email: rawEmail, nombre: rawNombre, constructora_id } = (await req.json()) as {
      email?: string;
      nombre?: string;
      constructora_id?: string;
    };

    if (!rawEmail || !rawNombre || !constructora_id) {
      return NextResponse.json(
        { error: "email, nombre y constructora_id son requeridos" },
        { status: 400 },
      );
    }

    const email = rawEmail.trim().toLowerCase();
    const nombre = rawNombre.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    const constructora = await prisma.constructora.findUnique({
      where: { id: constructora_id },
      select: { id: true, nombre: true },
    });
    if (!constructora) {
      return NextResponse.json({ error: "Constructora no encontrada" }, { status: 404 });
    }

    const existing = await prisma.usuario.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 },
      );
    }

    // Buscar (o crear) el rol "Administrador" de nivel ADMIN_GENERAL para la constructora
    let rol = await prisma.rol.findFirst({
      where: { constructora_id: constructora.id, nivel_acceso: "ADMIN_GENERAL" },
    });
    if (!rol) {
      rol = await prisma.rol.create({
        data: {
          constructora_id: constructora.id,
          nombre: "Administrador",
          nivel_acceso: "ADMIN_GENERAL",
          es_default: true,
        },
      });
    }

    const tempPassword = `OC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const { error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError) {
      return NextResponse.json(
        { error: `Error creando cuenta: ${authError.message}` },
        { status: 500 },
      );
    }

    const usuario = await prisma.usuario.create({
      data: {
        email,
        nombre,
        constructora_id: constructora.id,
        rol_id: rol.id,
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    try {
      await sendEmail({
        to: email,
        subject: `Te han nombrado Admin General en ${constructora.nombre}`,
        html: invitationEmailHtml({
          nombreInvitado: nombre,
          nombreConstructora: constructora.nombre,
          rol: "Administrador General",
          loginUrl: `${siteUrl}/login`,
          password: tempPassword,
        }),
      });
    } catch {
      // El email puede fallar; el password se devuelve en la respuesta también.
    }

    return NextResponse.json(
      { id: usuario.id, email, nombre, tempPassword },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/super-admin/admins-generales", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
