import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadEvidencia, deleteEvidencia } from "@/lib/storage";
import {
  requireUser,
  assertTareaInTenant,
  tenantErrorResponse,
} from "@/lib/tenant";
import { canApproveTasks } from "@/lib/access";
import {
  CAMPO_DIFERIDA,
  leerMarcaDiferida,
  resolverHoraDeCaptura,
} from "@/lib/evidencia-hora";

// POST /api/evidencias — subir foto o video de una tarea
// multipart/form-data: file, tarea_id, tipo, gps_lat?, gps_lng?,
// timestamp_captura?, diferida?
//
// `timestamp_captura` NO es la hora que se guarda: es la que el cliente declara
// para que el servidor compruebe que la foto es de ahora mismo. Lo que se
// escribe en la fila sale del reloj del servidor. La excepción es `diferida`,
// que usa la cola offline para subir lo que se capturó sin señal: ahí se guarda
// la hora declarada y la evidencia queda sin verificar. Ver `@/lib/evidencia-hora`.
export async function POST(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tarea_id = formData.get("tarea_id") as string;
    const tipo = formData.get("tipo") as "FOTO" | "VIDEO";
    const gps_lat = formData.get("gps_lat");
    const gps_lng = formData.get("gps_lng");
    const timestamp_captura = formData.get("timestamp_captura");
    const diferida = leerMarcaDiferida(formData.get(CAMPO_DIFERIDA));

    if (!file || !tarea_id || !tipo) {
      return NextResponse.json(
        { error: "file, tarea_id y tipo son requeridos" },
        { status: 400 }
      );
    }

    if (!["FOTO", "VIDEO"].includes(tipo)) {
      return NextResponse.json({ error: "tipo debe ser FOTO o VIDEO" }, { status: 400 });
    }

    // Validate Content-Type
    const allowedPhotoTypes = ["image/jpeg", "image/png"];
    const allowedVideoTypes = ["video/mp4"];
    if (tipo === "FOTO" && !allowedPhotoTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se aceptan image/jpeg y image/png" },
        { status: 400 }
      );
    }
    if (tipo === "VIDEO" && !allowedVideoTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido. Solo se acepta video/mp4" },
        { status: 400 }
      );
    }

    // Validate file size: photos max 10MB, videos max 50MB
    const maxSize = tipo === "FOTO" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: tipo === "FOTO" ? "La foto no puede superar 10 MB" : "El video no puede superar 50 MB" },
        { status: 400 }
      );
    }

    // Verificar que la tarea pertenezca a la constructora del usuario
    await assertTareaInTenant(tarea_id, constructoraId);

    // La hora se decide ANTES de subir un solo byte: si la evidencia no es de
    // ahora, no tiene sentido gastar el bucket en ella.
    const hora = resolverHoraDeCaptura({
      declarada: timestamp_captura,
      ahora: new Date(),
      diferida,
    });
    if (!hora.ok) {
      return NextResponse.json({ error: hora.mensaje }, { status: 400 });
    }

    // Límite de 4 fotos POR INTENTO, no por vida de la tarea.
    //
    // Contando toda la vida se creaba un callejón sin salida: una tarea
    // rechazada que ya había gastado sus cuatro fotos no se podía volver a
    // reportar nunca. El contratista se salvaba porque puede BORRAR sus
    // evidencias (es `esAsignado`); el personal de campo no, así que para él la
    // tarea quedaba muerta. La ruta del maestro —`/api/o/[token]/evidencias`—
    // ya contaba por intento; esto la iguala.
    if (tipo === "FOTO") {
      const ultimoRechazo = await prisma.aprobacion.findFirst({
        where: { tarea_id, estado: "NO_APROBADA" },
        orderBy: { fecha: "desc" },
        select: { fecha: true },
      });
      const count = await prisma.evidencia.count({
        where: {
          tarea_id,
          tipo: "FOTO",
          ...(ultimoRechazo ? { created_at: { gt: ultimoRechazo.fecha } } : {}),
        },
      });
      if (count >= 4) {
        return NextResponse.json(
          { error: "Máximo 4 fotos por intento" },
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
        timestamp_captura: hora.horaCaptura,
        tomada_por: usuario.id,
      },
    });

    // `hora_verificada` no es una columna: es lo que el par de fechas de la
    // fila ya dice. Va en la respuesta para que la pantalla pueda distinguir
    // una foto en vivo de una que estuvo en cola.
    return NextResponse.json(
      { ...evidencia, hora_verificada: hora.verificadaPorServidor },
      { status: 201 },
    );
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("POST /api/evidencias", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/evidencias?tarea_id=X
// Limpia todas las evidencias de una tarea PENDIENTE o NO_APROBADA. Sirve
// para que el contratista pueda reintentar el reporte sin acumular sobras de
// uploads anteriores (que dispararían el cap de 4 fotos por tarea).
export async function DELETE(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    const tarea_id = new URL(req.url).searchParams.get("tarea_id");
    if (!tarea_id) {
      return NextResponse.json({ error: "tarea_id requerido" }, { status: 400 });
    }

    await assertTareaInTenant(tarea_id, constructoraId);

    const tarea = await prisma.tarea.findUnique({
      where: { id: tarea_id },
      select: { id: true, estado: true, asignado_a: true },
    });
    if (!tarea) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }

    // Solo se puede limpiar mientras la tarea esté PENDIENTE o NO_APROBADA.
    if (tarea.estado !== "PENDIENTE" && tarea.estado !== "NO_APROBADA") {
      return NextResponse.json(
        { error: "Solo se pueden limpiar evidencias de tareas pendientes o rechazadas" },
        { status: 400 },
      );
    }

    // Autorización: el asignado o un supervisor.
    const usuarioRol = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { rol_ref: { select: { nivel_acceso: true } } },
    });
    const esAsignado = tarea.asignado_a === usuario.id;
    const esSupervisor = usuarioRol ? canApproveTasks(usuarioRol.rol_ref.nivel_acceso) : false;
    if (!esAsignado && !esSupervisor) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const evidencias = await prisma.evidencia.findMany({
      where: { tarea_id },
      select: { id: true, url_storage: true },
    });

    for (const e of evidencias) {
      try {
        await deleteEvidencia(e.url_storage);
      } catch (err) {
        console.warn(`No se pudo borrar evidencia ${e.id} de storage:`, err);
      }
    }
    await prisma.evidencia.deleteMany({ where: { tarea_id } });

    return NextResponse.json({ ok: true, eliminadas: evidencias.length });
  } catch (error) {
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("DELETE /api/evidencias", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
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
