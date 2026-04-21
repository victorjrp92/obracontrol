import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { sugerenciaNuevaEmailHtml } from "@/lib/email-templates/sugerencias";
import { getAccessibleProjectIds, canManageUsers, isAnyAdmin } from "@/lib/access";

// GET /api/sugerencias?estado=PENDIENTE|APROBADA|RECHAZADA|ALL
// ADMINISTRADOR: list suggestions for their constructora
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        constructora_id: true,
        rol_ref: { select: { nivel_acceso: true } },
      },
    });

    if (!admin || !(canManageUsers(admin.rol_ref.nivel_acceso) || isAnyAdmin(admin.rol_ref.nivel_acceso))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const accessible = await getAccessibleProjectIds(
      admin.id,
      admin.constructora_id,
      admin.rol_ref.nivel_acceso,
    );

    const url = new URL(req.url);
    const estadoParam = url.searchParams.get("estado") ?? "ALL";

    const where: Record<string, unknown> = {
      proyecto: {
        constructora_id: admin.constructora_id,
        ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
      },
    };

    if (estadoParam !== "ALL") {
      where.estado = estadoParam;
    }

    const sugerencias = await prisma.tareaSugerida.findMany({
      where,
      include: {
        contratista: { select: { id: true, nombre: true, email: true } },
        proyecto: { select: { id: true, nombre: true } },
        revisor: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(sugerencias);
  } catch (error) {
    console.error("GET /api/sugerencias", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/sugerencias
// CONTRATISTA: create a suggestion
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const contratista = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: { rol_ref: true },
    });

    if (!contratista || contratista.rol_ref.nivel_acceso !== "CONTRATISTA") {
      return NextResponse.json({ error: "Solo contratistas pueden sugerir tareas" }, { status: 403 });
    }

    const body = await req.json();
    const { proyecto_id, edificio_id, unidades, nombre, descripcion, foto_url } = body;

    if (!proyecto_id || !nombre || !unidades || !Array.isArray(unidades) || unidades.length === 0) {
      return NextResponse.json(
        { error: "proyecto_id, nombre y unidades (array) son requeridos" },
        { status: 400 }
      );
    }

    // Validate contratista has tasks in the selected proyecto
    const tareasEnProyecto = await prisma.tarea.count({
      where: {
        asignado_a: contratista.id,
        espacio: {
          unidad: {
            piso: {
              edificio: { proyecto_id },
            },
          },
        },
      },
    });

    if (tareasEnProyecto === 0) {
      return NextResponse.json(
        { error: "No tienes tareas asignadas en este proyecto" },
        { status: 403 }
      );
    }

    const sugerencia = await prisma.tareaSugerida.create({
      data: {
        contratista_id: contratista.id,
        proyecto_id,
        edificio_id: edificio_id ?? null,
        unidades,
        nombre,
        descripcion: descripcion ?? null,
        foto_url: foto_url ?? null,
      },
      include: {
        proyecto: { select: { nombre: true, constructora_id: true } },
        contratista: { select: { nombre: true } },
      },
    });

    // Notify all ADMINISTRADORs in the constructora
    try {
      const admins = await prisma.usuario.findMany({
        where: {
          constructora_id: sugerencia.proyecto.constructora_id,
          rol_ref: { nivel_acceso: { in: ["ADMIN_GENERAL", "ADMIN_PROYECTO"] } },
        },
        select: { email: true },
      });

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
      const html = sugerenciaNuevaEmailHtml({
        contratistaNombre: sugerencia.contratista.nombre,
        tareaName: sugerencia.nombre,
        proyectoName: sugerencia.proyecto.nombre,
        url: `${siteUrl}/dashboard/sugerencias`,
      });

      for (const admin of admins) {
        sendEmail({
          to: admin.email,
          subject: `Nueva sugerencia de tarea: ${sugerencia.nombre}`,
          html,
        }).catch((err) => console.error("Email sugerencia nueva falló:", err));
      }
    } catch (emailErr) {
      console.error("Error enviando emails de sugerencia:", emailErr);
    }

    return NextResponse.json(sugerencia, { status: 201 });
  } catch (error) {
    console.error("POST /api/sugerencias", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
