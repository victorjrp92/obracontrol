import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadEvidencia } from "@/lib/storage";
import {
  requireUser,
  assertTareaInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";

// POST /api/evidencias — subir foto o video de una tarea
// multipart/form-data: file, tarea_id, tipo, gps_lat?, gps_lng?, timestamp_captura
export async function POST(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

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
      return NextResponse.json({ error: "tipo debe ser FOTO o VIDEO" }, { status: 400 });
    }

    // Verificar que la tarea pertenezca a la constructora del usuario
    await assertTareaInTenant(tarea_id, constructoraId);

    // Validar límite de fotos (máx 4)
    if (tipo === "FOTO") {
      const count = await prisma.evidencia.count({
        where: { tarea_id, tipo: "FOTO" },
      });
      if (count >= 4) {
        return NextResponse.json(
          { error: "Máximo 4 fotos por tarea" },
          { status: 400 }
        );
      }
    }

    // Subir a Supabase Storage
    const url = await uploadEvidencia(file, tarea_id, usuario.id, tipo);

    // Guardar en DB
    const evidencia = await prisma.evidencia.create({
      data: {
        tarea_id,
        tipo,
        url_storage: url,
        gps_lat: gps_lat ? parseFloat(gps_lat as string) : null,
        gps_lng: gps_lng ? parseFloat(gps_lng as string) : null,
        timestamp_captura: timestamp_captura ? new Date(timestamp_captura) : new Date(),
        tomada_por: usuario.id,
      },
    });

    return NextResponse.json(evidencia, { status: 201 });
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("POST /api/evidencias", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/evidencias?tarea_id=
export async function GET(req: NextRequest) {
  try {
    const { constructoraId } = await requireUser();

    const tarea_id = new URL(req.url).searchParams.get("tarea_id");
    if (!tarea_id) {
      return NextResponse.json({ error: "tarea_id requerido" }, { status: 400 });
    }

    await assertTareaInTenant(tarea_id, constructoraId);

    const evidencias = await prisma.evidencia.findMany({
      where: { tarea_id },
      orderBy: { timestamp_captura: "asc" },
    });

    return NextResponse.json(evidencias);
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("GET /api/evidencias", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
