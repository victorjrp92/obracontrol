import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { validateObreroBasico } from "@/lib/obrero";
import type { EspecialidadObrero } from "@/generated/prisma";

// GET /api/obreros — list obreros for this contratista
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json(
        { error: "Solo contratistas pueden gestionar obreros" },
        { status: 403 },
      );
    }

    const obreros = await prisma.obrero.findMany({
      where: { contratista_id: usuario.id },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        nombre: true,
        token: true,
        activo: true,
        fecha_inicio: true,
        fecha_expiracion: true,
        created_at: true,
        cedula: true,
        telefono: true,
        especialidad: true,
        eps: true,
        arl: true,
        anos_experiencia: true,
        score_total: true,
        score_calidad: true,
        score_velocidad: true,
        score_cumplimiento: true,
        evidencias_aprobadas: true,
        evidencias_rechazadas: true,
        tareas_completadas: true,
        _count: { select: { evidencias: true } },
      },
    });

    return NextResponse.json(obreros);
  } catch (error) {
    console.error("GET /api/obreros", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/obreros — create a new obrero (información básica obligatoria)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (usuario.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json(
        { error: "Solo contratistas pueden crear obreros" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      nombre,
      fecha_inicio,
      fecha_expiracion,
      cedula,
      telefono,
      especialidad,
      eps,
      arl,
      // opcionales
      fecha_nacimiento,
      direccion,
      contacto_emergencia,
      contacto_emergencia_telefono,
      tipo_sangre,
      anos_experiencia,
      foto_url,
    } = body as Record<string, string | number | undefined>;

    if (!nombre || !fecha_inicio || !fecha_expiracion) {
      return NextResponse.json(
        { error: "nombre, fecha_inicio y fecha_expiracion son requeridos" },
        { status: 400 },
      );
    }

    const trimmedNombre = String(nombre).trim();
    if (trimmedNombre.length < 2 || trimmedNombre.length > 100) {
      return NextResponse.json(
        { error: "El nombre debe tener entre 2 y 100 caracteres" },
        { status: 400 },
      );
    }

    // Validación de información básica del negocio
    const errors = validateObreroBasico({
      cedula: cedula as string | undefined,
      telefono: telefono as string | undefined,
      especialidad: especialidad as string | undefined,
      eps: eps as string | undefined,
      arl: arl as string | undefined,
    });
    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0].message, fields: errors },
        { status: 400 },
      );
    }

    const inicio = new Date(String(fecha_inicio));
    const expiracion = new Date(String(fecha_expiracion));
    if (isNaN(inicio.getTime()) || isNaN(expiracion.getTime())) {
      return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
    }
    if (expiracion <= inicio) {
      return NextResponse.json(
        { error: "La fecha de expiración debe ser posterior a la de inicio" },
        { status: 400 },
      );
    }

    // Cedula única dentro de la constructora
    const cedulaTrim = String(cedula).trim();
    const dup = await prisma.obrero.findFirst({
      where: { constructora_id: usuario.constructora_id, cedula: cedulaTrim },
      select: { id: true, nombre: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: `Ya existe un obrero con esa cédula: ${dup.nombre}` },
        { status: 409 },
      );
    }

    const obrero = await prisma.obrero.create({
      data: {
        nombre: trimmedNombre,
        contratista_id: usuario.id,
        constructora_id: usuario.constructora_id,
        fecha_inicio: inicio,
        fecha_expiracion: expiracion,
        cedula: cedulaTrim,
        telefono: String(telefono).trim(),
        especialidad: especialidad as EspecialidadObrero,
        eps: String(eps).trim(),
        arl: String(arl).trim(),
        fecha_nacimiento: fecha_nacimiento ? new Date(String(fecha_nacimiento)) : null,
        direccion: direccion ? String(direccion).trim() : null,
        contacto_emergencia: contacto_emergencia ? String(contacto_emergencia).trim() : null,
        contacto_emergencia_telefono: contacto_emergencia_telefono
          ? String(contacto_emergencia_telefono).trim()
          : null,
        tipo_sangre: tipo_sangre ? String(tipo_sangre).trim() : null,
        anos_experiencia:
          typeof anos_experiencia === "number"
            ? anos_experiencia
            : anos_experiencia
            ? Number(anos_experiencia)
            : null,
        foto_url: foto_url ? String(foto_url).trim() : null,
      },
      select: {
        id: true,
        nombre: true,
        token: true,
        activo: true,
        fecha_inicio: true,
        fecha_expiracion: true,
        created_at: true,
        cedula: true,
        especialidad: true,
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
    const url = `${siteUrl}/o/${obrero.token}`;

    return NextResponse.json({ ...obrero, url }, { status: 201 });
  } catch (error) {
    console.error("POST /api/obreros", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
