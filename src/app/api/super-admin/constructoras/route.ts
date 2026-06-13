import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/super-admin-guard";
import type { PlanTipo } from "@/generated/prisma";

export async function GET() {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const constructoras = await prisma.constructora.findMany({
    include: { _count: { select: { proyectos: true, usuarios: true } } },
    orderBy: { created_at: "desc" },
  });
  return NextResponse.json(constructoras);
}

export async function POST(req: NextRequest) {
  const su = await requireSuperAdmin();
  if (!su) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  try {
    const body = await req.json();
    const { nombre, nit, ciudad, direccion, telefono, sitio_web, plan_suscripcion } = body as {
      nombre?: string;
      nit?: string | null;
      ciudad?: string | null;
      direccion?: string | null;
      telefono?: string | null;
      sitio_web?: string | null;
      plan_suscripcion?: PlanTipo;
    };

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json({ error: "Nombre requerido (mínimo 2 caracteres)" }, { status: 400 });
    }

    if (nit) {
      const exists = await prisma.constructora.findUnique({ where: { nit } });
      if (exists) {
        return NextResponse.json({ error: "Ya existe una constructora con ese NIT" }, { status: 409 });
      }
    }

    const constructora = await prisma.constructora.create({
      data: {
        nombre: nombre.trim(),
        nit: nit || null,
        ciudad: ciudad || null,
        direccion: direccion || null,
        telefono: telefono || null,
        sitio_web: sitio_web || null,
        plan_suscripcion: plan_suscripcion ?? "OBRA",
      },
    });

    // Crear roles default para la nueva constructora
    const defaultRoles = [
      { nombre: "Administrador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
      { nombre: "Administrador Proyectos", nivel_acceso: "ADMIN_PROYECTO" as const, es_default: true },
      { nombre: "Coordinador", nivel_acceso: "ADMIN_GENERAL" as const, es_default: true },
      { nombre: "Director de obra", nivel_acceso: "DIRECTIVO" as const, es_default: true },
      { nombre: "Contratista instalador", nivel_acceso: "CONTRATISTA" as const, es_default: true },
      { nombre: "Auxiliar de obra", nivel_acceso: "OBRERO" as const, es_default: true },
    ];

    await prisma.rol.createMany({
      data: defaultRoles.map((r) => ({
        constructora_id: constructora.id,
        nombre: r.nombre,
        nivel_acceso: r.nivel_acceso,
        es_default: r.es_default,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(constructora, { status: 201 });
  } catch (error) {
    console.error("POST /api/super-admin/constructoras", error);
    return NextResponse.json({ error: "Error al crear constructora" }, { status: 500 });
  }
}
