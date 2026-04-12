import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import {
  sugerenciaAprobadaEmailHtml,
  sugerenciaRechazadaEmailHtml,
} from "@/lib/email-templates/sugerencias";

// PATCH /api/sugerencias/[id]
// ADMINISTRADOR: approve or reject a suggestion
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = await prisma.usuario.findUnique({
      where: { email: user.email! },
      include: { rol_ref: true },
    });

    if (!admin || !["ADMINISTRADOR", "DIRECTIVO"].includes(admin.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { estado, motivo_rechazo, tiempo_acordado_dias, fase_id } = body;

    if (!["APROBADA", "RECHAZADA"].includes(estado)) {
      return NextResponse.json(
        { error: "estado debe ser APROBADA o RECHAZADA" },
        { status: 400 }
      );
    }

    // Load the suggestion
    const sugerencia = await prisma.tareaSugerida.findUnique({
      where: { id },
      include: {
        contratista: { select: { id: true, nombre: true, email: true } },
        proyecto: { select: { id: true, nombre: true, constructora_id: true } },
      },
    });

    if (!sugerencia) {
      return NextResponse.json({ error: "Sugerencia no encontrada" }, { status: 404 });
    }

    if (sugerencia.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "Esta sugerencia ya fue procesada" },
        { status: 400 }
      );
    }

    // Validate the sugerencia belongs to the admin's constructora
    if (sugerencia.proyecto.constructora_id !== admin.constructora_id) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    if (estado === "APROBADA") {
      if (!tiempo_acordado_dias || !fase_id) {
        return NextResponse.json(
          { error: "tiempo_acordado_dias y fase_id son requeridos para aprobar" },
          { status: 400 }
        );
      }

      // Parse unidades from the sugerencia
      const unidades = sugerencia.unidades as string[];

      // For each unidad, find or create an Espacio, then create a Tarea
      await prisma.$transaction(async (tx) => {
        // Update sugerencia status
        await tx.tareaSugerida.update({
          where: { id },
          data: {
            estado: "APROBADA",
            revisado_por: admin.id,
          },
        });

        // Create one Tarea per unidad
        for (const unidadId of unidades) {
          // Find or create an Espacio for this unidad
          let espacio = await tx.espacio.findFirst({
            where: {
              unidad_id: unidadId,
              nombre: sugerencia.nombre,
            },
          });

          if (!espacio) {
            espacio = await tx.espacio.create({
              data: {
                unidad_id: unidadId,
                nombre: sugerencia.nombre,
              },
            });
          }

          // Create the Tarea
          await tx.tarea.create({
            data: {
              espacio_id: espacio.id,
              fase_id,
              nombre: sugerencia.nombre,
              tiempo_acordado_dias: parseInt(String(tiempo_acordado_dias), 10),
              asignado_a: sugerencia.contratista_id,
              notas: sugerencia.descripcion ?? null,
              foto_referencia_url: sugerencia.foto_url ?? null,
            },
          });
        }
      });

      // Send approval email to contratista
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
        const html = sugerenciaAprobadaEmailHtml({
          tareaName: sugerencia.nombre,
          proyectoName: sugerencia.proyecto.nombre,
          url: `${siteUrl}/contratista`,
        });
        sendEmail({
          to: sugerencia.contratista.email,
          subject: `Tu sugerencia fue aprobada: ${sugerencia.nombre}`,
          html,
        }).catch((err) => console.error("Email aprobación sugerencia falló:", err));
      } catch (emailErr) {
        console.error("Error enviando email de aprobación de sugerencia:", emailErr);
      }
    } else {
      // RECHAZADA
      if (!motivo_rechazo) {
        return NextResponse.json(
          { error: "motivo_rechazo es requerido para rechazar" },
          { status: 400 }
        );
      }

      await prisma.tareaSugerida.update({
        where: { id },
        data: {
          estado: "RECHAZADA",
          motivo_rechazo,
          revisado_por: admin.id,
        },
      });

      // Send rejection email to contratista
      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
        const html = sugerenciaRechazadaEmailHtml({
          tareaName: sugerencia.nombre,
          proyectoName: sugerencia.proyecto.nombre,
          motivo: motivo_rechazo,
          url: `${siteUrl}/contratista`,
        });
        sendEmail({
          to: sugerencia.contratista.email,
          subject: `Tu sugerencia no fue aprobada: ${sugerencia.nombre}`,
          html,
        }).catch((err) => console.error("Email rechazo sugerencia falló:", err));
      } catch (emailErr) {
        console.error("Error enviando email de rechazo de sugerencia:", emailErr);
      }
    }

    const sugerenciaActualizada = await prisma.tareaSugerida.findUnique({
      where: { id },
      include: {
        contratista: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        revisor: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json(sugerenciaActualizada);
  } catch (error) {
    console.error("PATCH /api/sugerencias/[id]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
