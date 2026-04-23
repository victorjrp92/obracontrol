import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUsuarioActual } from "@/lib/data";
import { canManageUsers } from "@/lib/access";

const CONSTRUCTORA_SELECT = {
  id: true,
  nombre: true,
  nit: true,
  logo_url: true,
  direccion: true,
  ciudad: true,
  telefono: true,
  sitio_web: true,
  descripcion: true,
  plan_suscripcion: true,
} as const;

export async function GET() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageUsers(usuario.rol_ref.nivel_acceso)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const constructora = await prisma.constructora.findUnique({
    where: { id: usuario.constructora_id },
    select: CONSTRUCTORA_SELECT,
  });

  return NextResponse.json(constructora);
}

export async function PATCH(req: NextRequest) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!canManageUsers(usuario.rol_ref.nivel_acceso)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const { nombre, nit, direccion, ciudad, telefono, sitio_web, descripcion } = body;

  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const constructora = await prisma.constructora.update({
    where: { id: usuario.constructora_id },
    data: {
      nombre: nombre.trim(),
      nit: nit?.trim() || null,
      direccion: direccion?.trim() || null,
      ciudad: ciudad?.trim() || null,
      telefono: telefono?.trim() || null,
      sitio_web: sitio_web?.trim() || null,
      descripcion: descripcion?.trim() || null,
    },
    select: CONSTRUCTORA_SELECT,
  });

  return NextResponse.json(constructora);
}
