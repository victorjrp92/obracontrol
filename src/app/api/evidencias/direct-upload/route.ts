import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  requireUser,
  assertTareaInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";
import { canApproveTasks } from "@/lib/access";

const BUCKET = "evidencias";

// POST /api/evidencias/direct-upload
// Body: { tarea_id, tipo: "FOTO" | "VIDEO", ext: "mp4" | "jpg" | "png" }
// Devuelve: { path, token, signedUrl } para que el cliente suba directo a
// Supabase Storage. Esto bypassa el límite de 4.5 MB de Vercel para videos.
export async function POST(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    const body = (await req.json()) as {
      tarea_id?: string;
      tipo?: "FOTO" | "VIDEO";
      ext?: string;
    };
    const { tarea_id, tipo, ext } = body;

    if (!tarea_id || !tipo) {
      return NextResponse.json(
        { error: "tarea_id y tipo son requeridos" },
        { status: 400 },
      );
    }
    if (tipo !== "FOTO" && tipo !== "VIDEO") {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }
    const safeExt = (ext ?? (tipo === "FOTO" ? "jpg" : "mp4"))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 4);

    await assertTareaInTenant(tarea_id, constructoraId);

    const tarea = await prisma.tarea.findUnique({
      where: { id: tarea_id },
      select: { id: true, estado: true, asignado_a: true },
    });
    if (!tarea) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    if (tarea.estado !== "PENDIENTE" && tarea.estado !== "NO_APROBADA") {
      return NextResponse.json(
        { error: "Solo se puede subir evidencia a tareas pendientes o rechazadas" },
        { status: 400 },
      );
    }

    const usuarioRol = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { rol_ref: { select: { nivel_acceso: true } } },
    });
    const esAsignado = tarea.asignado_a === usuario.id;
    const esSupervisor = usuarioRol
      ? canApproveTasks(usuarioRol.rol_ref.nivel_acceso)
      : false;
    if (!esAsignado && !esSupervisor) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Cap de 4 fotos por tarea (no aplica para VIDEO).
    if (tipo === "FOTO") {
      const count = await prisma.evidencia.count({
        where: { tarea_id, tipo: "FOTO" },
      });
      if (count >= 4) {
        return NextResponse.json(
          { error: "Máximo 4 fotos por tarea" },
          { status: 400 },
        );
      }
    }

    const path = `${tarea_id}/${usuario.id}/${Date.now()}.${safeExt}`;

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json(
        { error: "No se pudo generar la URL de subida" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (err) {
    const resp = tenantErrorResponse(err);
    if (resp) return resp;
    console.error("POST /api/evidencias/direct-upload", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/evidencias/direct-upload
// Body: { tarea_id, tipo, path, gps_lat?, gps_lng?, timestamp_captura? }
// Confirma que el archivo fue subido directamente a Storage y crea el
// registro Evidencia en la BD.
export async function PUT(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    const body = (await req.json()) as {
      tarea_id?: string;
      tipo?: "FOTO" | "VIDEO";
      path?: string;
      gps_lat?: number | null;
      gps_lng?: number | null;
      timestamp_captura?: string;
    };

    if (!body.tarea_id || !body.tipo || !body.path) {
      return NextResponse.json(
        { error: "tarea_id, tipo y path son requeridos" },
        { status: 400 },
      );
    }
    if (body.tipo !== "FOTO" && body.tipo !== "VIDEO") {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    await assertTareaInTenant(body.tarea_id, constructoraId);

    const tarea = await prisma.tarea.findUnique({
      where: { id: body.tarea_id },
      select: { estado: true, asignado_a: true },
    });
    if (!tarea) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // El path debe empezar con tarea_id/usuario_id/ para que el cliente no
    // pueda inyectar un path de otro tenant.
    const expectedPrefix = `${body.tarea_id}/${usuario.id}/`;
    if (!body.path.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "path inválido" }, { status: 400 });
    }

    const usuarioRol = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { rol_ref: { select: { nivel_acceso: true } } },
    });
    const esAsignado = tarea.asignado_a === usuario.id;
    const esSupervisor = usuarioRol
      ? canApproveTasks(usuarioRol.rol_ref.nivel_acceso)
      : false;
    if (!esAsignado && !esSupervisor) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const evidencia = await prisma.evidencia.create({
      data: {
        tarea_id: body.tarea_id,
        tipo: body.tipo,
        url_storage: body.path,
        gps_lat: body.gps_lat ?? null,
        gps_lng: body.gps_lng ?? null,
        timestamp_captura: body.timestamp_captura
          ? new Date(body.timestamp_captura)
          : new Date(),
        tomada_por: usuario.id,
      },
    });

    return NextResponse.json(evidencia, { status: 201 });
  } catch (err) {
    const resp = tenantErrorResponse(err);
    if (resp) return resp;
    console.error("PUT /api/evidencias/direct-upload", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
