import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ESPECIALIDADES } from "@/lib/obrero";
import type { EspecialidadObrero } from "@/generated/prisma";

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return prisma.usuario.findUnique({
    where: { email: user.email },
    select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
  });
}

// GET /api/obreros/[id] — ficha completa del obrero (contratista dueño o admin)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const obrero = await prisma.obrero.findUnique({
      where: { id },
      include: {
        contratista: { select: { id: true, nombre: true, email: true } },
        _count: { select: { evidencias: true } },
      },
    });
    if (!obrero) return NextResponse.json({ error: "Obrero no encontrado" }, { status: 404 });

    // Acceso: el contratista dueño, o admin/directivo de la misma constructora, o super admin
    const nivel = caller.rol_ref.nivel_acceso;
    const esContratistaDueno = nivel === "CONTRATISTA" && obrero.contratista_id === caller.id;
    const esAdminMismaConstructora =
      ["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(nivel) &&
      caller.constructora_id === obrero.constructora_id;
    const esSuperAdmin = nivel === "SUPER_ADMIN";

    if (!esContratistaDueno && !esAdminMismaConstructora && !esSuperAdmin) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    return NextResponse.json(obrero);
  } catch (error) {
    console.error("GET /api/obreros/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/obreros/[id] — actualizar campos
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (caller.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;

    const obrero = await prisma.obrero.findUnique({
      where: { id },
      select: { contratista_id: true, constructora_id: true, cedula: true },
    });
    if (!obrero || obrero.contratista_id !== caller.id) {
      return NextResponse.json({ error: "Obrero no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    // Operativo
    if (body.fecha_expiracion !== undefined) {
      const fecha = new Date(body.fecha_expiracion);
      if (isNaN(fecha.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      }
      data.fecha_expiracion = fecha;
    }
    if (body.activo !== undefined) data.activo = !!body.activo;
    if (body.nombre !== undefined) {
      const n = String(body.nombre).trim();
      if (n.length < 2 || n.length > 100) {
        return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
      }
      data.nombre = n;
    }

    // Información básica
    if (body.cedula !== undefined) {
      const cedula = String(body.cedula).trim();
      if (cedula && !/^[0-9]+$/.test(cedula)) {
        return NextResponse.json({ error: "Cédula solo dígitos" }, { status: 400 });
      }
      if (cedula && cedula !== obrero.cedula) {
        const dup = await prisma.obrero.findFirst({
          where: { constructora_id: obrero.constructora_id, cedula, id: { not: id } },
          select: { id: true },
        });
        if (dup) return NextResponse.json({ error: "Cédula ya usada" }, { status: 409 });
      }
      data.cedula = cedula || null;
    }
    if (body.telefono !== undefined) data.telefono = String(body.telefono).trim() || null;
    if (body.especialidad !== undefined) {
      if (!ESPECIALIDADES.includes(body.especialidad as EspecialidadObrero)) {
        return NextResponse.json({ error: "Especialidad inválida" }, { status: 400 });
      }
      data.especialidad = body.especialidad;
    }
    if (body.eps !== undefined) data.eps = String(body.eps).trim() || null;
    if (body.arl !== undefined) data.arl = String(body.arl).trim() || null;

    // Opcionales
    if (body.fecha_nacimiento !== undefined) {
      data.fecha_nacimiento = body.fecha_nacimiento ? new Date(body.fecha_nacimiento) : null;
    }
    if (body.direccion !== undefined) data.direccion = String(body.direccion).trim() || null;
    if (body.contacto_emergencia !== undefined) {
      data.contacto_emergencia = String(body.contacto_emergencia).trim() || null;
    }
    if (body.contacto_emergencia_telefono !== undefined) {
      data.contacto_emergencia_telefono = String(body.contacto_emergencia_telefono).trim() || null;
    }
    if (body.tipo_sangre !== undefined) data.tipo_sangre = String(body.tipo_sangre).trim() || null;
    if (body.anos_experiencia !== undefined) {
      data.anos_experiencia =
        body.anos_experiencia === null || body.anos_experiencia === ""
          ? null
          : Number(body.anos_experiencia);
    }
    if (body.foto_url !== undefined) data.foto_url = String(body.foto_url).trim() || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updated = await prisma.obrero.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/obreros/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/obreros/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const caller = await getCaller();
    if (!caller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (caller.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const obrero = await prisma.obrero.findUnique({
      where: { id },
      select: { contratista_id: true, _count: { select: { evidencias: true } } },
    });
    if (!obrero || obrero.contratista_id !== caller.id) {
      return NextResponse.json({ error: "Obrero no encontrado" }, { status: 404 });
    }
    if (obrero._count.evidencias > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar un obrero con evidencias. Desactívalo en su lugar." },
        { status: 400 },
      );
    }

    await prisma.obrero.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/obreros/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
