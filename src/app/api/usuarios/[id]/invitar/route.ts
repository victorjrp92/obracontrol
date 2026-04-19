import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { invitationEmailHtml } from "@/lib/email-templates/invitation";
import { getRolLabel } from "@/lib/permissions";
import { canManageUsers, isAnyAdmin } from "@/lib/access";

// POST /api/usuarios/[id]/invitar — send invitation to a user without auth account
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
        constructora: { select: { id: true, nombre: true } },
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
        { error: "Sin permisos para enviar invitaciones" },
        { status: 403 },
      );
    }

    const { id } = await params;

    // Find the target user
    const target = await prisma.usuario.findUnique({
      where: { id },
      include: { rol_ref: { select: { nombre: true, nivel_acceso: true } } },
    });
    if (!target || target.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 },
      );
    }

    // Check if already invited
    if (target.invitado) {
      return NextResponse.json(
        { error: "Ya se envió invitación a este usuario" },
        { status: 400 },
      );
    }

    // Create Supabase auth account
    const tempPassword = `OC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const { error: authError } =
      await getSupabaseAdmin().auth.admin.createUser({
        email: target.email,
        password: tempPassword,
        email_confirm: true,
      });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return NextResponse.json(
        { error: `Error creando cuenta: ${authError.message}` },
        { status: 500 },
      );
    }

    // Mark as invited
    await prisma.usuario.update({
      where: { id },
      data: { invitado: true },
    });

    // Send invitation email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
    try {
      await sendEmail({
        to: target.email,
        subject: `Te han invitado a ${currentUser.constructora.nombre} en Seiricon`,
        html: invitationEmailHtml({
          nombreInvitado: target.nombre,
          nombreConstructora: currentUser.constructora.nombre,
          rol: getRolLabel(target.rol_ref.nombre),
          loginUrl: `${siteUrl}/login`,
          password: tempPassword,
        }),
      });
    } catch {
      console.error("Failed to send invitation email");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/usuarios/[id]/invitar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
