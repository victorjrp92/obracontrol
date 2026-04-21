import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";

export async function GET() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const constructora = await prisma.constructora.findUnique({
    where: { id: usuario.constructora_id },
    select: {
      id: true,
      nombre: true,
      nit: true,
      logo_url: true,
      plan_suscripcion: true,
    },
  });

  return NextResponse.json(constructora);
}

export async function PATCH(req: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, nit } = body;

  if (!nombre?.trim() || !nit?.trim()) {
    return NextResponse.json({ error: "Nombre y NIT son obligatorios" }, { status: 400 });
  }

  const constructora = await prisma.constructora.update({
    where: { id: usuario.constructora_id },
    data: {
      nombre: nombre.trim(),
      nit: nit.trim(),
    },
    select: {
      id: true,
      nombre: true,
      nit: true,
      logo_url: true,
      plan_suscripcion: true,
    },
  });

  return NextResponse.json(constructora);
}
