import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin, isSuperAdmin } from "@/lib/access";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    const nivel = currentUser.rol_ref.nivel_acceso;
    if (!(isGeneralAdmin(nivel) || isSuperAdmin(nivel))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const clientes = await prisma.cliente.findMany({
      where: { constructora_id: currentUser.constructora_id },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(clientes);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    {
      const nivel = currentUser.rol_ref.nivel_acceso;
      if (!(isGeneralAdmin(nivel) || isSuperAdmin(nivel))) {
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      }
    }

    const body = await req.json();
    const nombre = String(body.nombre ?? "").trim();
    if (!nombre || nombre.length > 200) {
      return NextResponse.json({ error: "Nombre es requerido (max 200 caracteres)" }, { status: 400 });
    }

    const cliente = await prisma.cliente.create({
      data: {
        constructora_id: currentUser.constructora_id,
        nombre,
        nit: body.nit ? String(body.nit).trim().slice(0, 50) : null,
        contacto: body.contacto ? String(body.contacto).trim().slice(0, 200) : null,
        telefono: body.telefono ? String(body.telefono).trim().slice(0, 30) : null,
        email: body.email ? String(body.email).trim().slice(0, 100) : null,
      },
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    {
      const nivel = currentUser.rol_ref.nivel_acceso;
      if (!(isGeneralAdmin(nivel) || isSuperAdmin(nivel))) {
        return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      }
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const cliente = await prisma.cliente.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
    });
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    await prisma.cliente.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
