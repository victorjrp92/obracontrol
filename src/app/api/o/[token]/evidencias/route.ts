import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateObreroToken } from "@/lib/data-obrero";
import { uploadEvidencia } from "@/lib/storage";

// POST /api/o/[token]/evidencias — obrero uploads evidence (photo/video)
// No Supabase Auth required — token IS the auth
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const obrero = await validateObreroToken(token);
    if (!obrero) {
      return NextResponse.json(
        { error: "Token invalido o expirado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tarea_id = formData.get("tarea_id") as string;
    const tipo = formData.get("tipo") as "FOTO" | "VIDEO";
    const gps_lat = formData.get("gps_lat");
    const gps_lng = formData.get("gps_lng");
    const timestamp_captura = formData.get("timestamp_captura") as string;

    if (!file || !tarea_id || !tipo) {
      return NextResponse.json(
        { error: "file, tarea_id y tipo son requeridos" },
        { status: 400 }
      );
    }

    if (!["FOTO", "VIDEO"].includes(tipo)) {
      return NextResponse.json(
        { error: "tipo debe ser FOTO o VIDEO" },
        { status: 400 }
      );
    }

    // Verify the task exists and belongs to the obrero's contratista
    const tarea = await prisma.tarea.findUnique({ where: { id: tarea_id } });
    if (!tarea) {
      return NextResponse.json(
        { error: "Tarea no encontrada" },
        { status: 404 }
      );
    }
    if (tarea.asignado_a !== obrero.contratista_id) {
      return NextResponse.json(
        { error: "No tienes permiso para esta tarea" },
        { status: 403 }
      );
    }

    // Photo limit: max 4 per task
    if (tipo === "FOTO") {
      const count = await prisma.evidencia.count({
        where: { tarea_id, tipo: "FOTO" },
      });
      if (count >= 4) {
        return NextResponse.json(
          { error: "Maximo 4 fotos por tarea" },
          { status: 400 }
        );
      }
    }

    // Upload to Supabase Storage using obrero id as the "user" path segment
    const url = await uploadEvidencia(file, tarea_id, obrero.id, tipo);

    // Save evidence record — obrero_id set, tomada_por stays null
    const evidencia = await prisma.evidencia.create({
      data: {
        tarea_id,
        tipo,
        url_storage: url,
        gps_lat: gps_lat ? parseFloat(gps_lat as string) : null,
        gps_lng: gps_lng ? parseFloat(gps_lng as string) : null,
        timestamp_captura: timestamp_captura
          ? new Date(timestamp_captura)
          : new Date(),
        obrero_id: obrero.id,
        // tomada_por stays null for obrero-uploaded evidence
      },
    });

    return NextResponse.json(evidencia, { status: 201 });
  } catch (error) {
    console.error("POST /api/o/[token]/evidencias", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
