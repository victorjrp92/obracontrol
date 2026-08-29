import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { isGeneralAdmin } from "@/lib/access";
import { borrarArchivos } from "@/lib/storage";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, email: true, nombre: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Solo el administrador general puede eliminar proyectos" }, { status: 403 });
    }

    const { id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
      select: { id: true, nombre: true },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { password, codigo_verificacion } = body as { password?: string; codigo_verificacion?: string };

    if (!password) {
      return NextResponse.json({ error: "Se requiere la contraseña" }, { status: 400 });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
    }

    if (!codigo_verificacion) {
      const codigo = crypto.randomBytes(3).toString("hex").toUpperCase();

      await prisma.auditLog.create({
        data: {
          proyecto_id: proyecto.id,
          usuario_id: currentUser.id,
          accion: "DELETE_REQUEST",
          campo: "codigo_verificacion",
          valor_nuevo: codigo,
        },
      });

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://seiricon.com";
      const nombreSafe = escapeHtml(proyecto.nombre);
      try {
        await sendEmail({
          to: currentUser.email,
          subject: `Código de verificación para eliminar proyecto: ${proyecto.nombre}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
              <h2 style="color:#1e293b;">Confirmar eliminación de proyecto</h2>
              <p style="color:#64748b;">Estás a punto de eliminar el proyecto <strong>${nombreSafe}</strong>. Esta acción es irreversible.</p>
              <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
                <span style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#1e293b;">${codigo}</span>
              </div>
              <p style="color:#94a3b8;font-size:13px;">Si no solicitaste esta acción, ignora este correo.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
              <p style="color:#94a3b8;font-size:12px;">Seiricon · ${siteUrl}</p>
            </div>
          `,
        });
      } catch {
        return NextResponse.json({ error: "Error enviando código de verificación" }, { status: 500 });
      }

      return NextResponse.json({ step: "codigo_enviado" });
    }

    // Check failed attempts (max 5 in the last 10 minutes)
    const recentAttempts = await prisma.auditLog.count({
      where: {
        proyecto_id: proyecto.id,
        usuario_id: currentUser.id,
        accion: "DELETE_REQUEST",
        campo: "codigo_intento_fallido",
        created_at: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    if (recentAttempts >= 5) {
      return NextResponse.json({ error: "Demasiados intentos. Solicita un nuevo código." }, { status: 429 });
    }

    const recentLog = await prisma.auditLog.findFirst({
      where: {
        proyecto_id: proyecto.id,
        usuario_id: currentUser.id,
        accion: "DELETE_REQUEST",
        campo: "codigo_verificacion",
        created_at: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { created_at: "desc" },
    });

    if (!recentLog || recentLog.valor_nuevo !== codigo_verificacion) {
      await prisma.auditLog.create({
        data: {
          proyecto_id: proyecto.id,
          usuario_id: currentUser.id,
          accion: "DELETE_REQUEST",
          campo: "codigo_intento_fallido",
          valor_nuevo: "failed",
        },
      });
      return NextResponse.json({ error: "Código de verificación incorrecto o expirado" }, { status: 400 });
    }

    // ── Rutas de los archivos, ANTES de borrar ────────────────────────────
    // Obligatorio recogerlas aquí: al borrar el proyecto, las filas de
    // Evidencia y Gasto caen en cascada y con ellas la única referencia a los
    // archivos del bucket. Después ya no hay forma de saber cuáles eran suyos.
    //
    // Hasta este arreglo eso era justo lo que pasaba: se borraban las filas y
    // las fotos del interior de las obras se quedaban en Storage para siempre,
    // pese a que la política de privacidad promete que los datos se eliminan.
    const [evidencias, gastos] = await Promise.all([
      prisma.evidencia.findMany({
        where: {
          tarea: {
            espacio: { unidad: { piso: { edificio: { proyecto_id: proyecto.id } } } },
          },
        },
        select: { url_storage: true },
      }),
      prisma.gasto.findMany({
        where: { proyecto_id: proyecto.id, factura_url: { not: null } },
        select: { factura_url: true },
      }),
    ]);

    const archivos = [
      ...evidencias.map((e) => e.url_storage),
      ...gastos.map((g) => g.factura_url),
    ];

    // ── Base de datos primero, Storage después ────────────────────────────
    // El orden es una decisión de seguridad, no de estilo. Si falla el segundo
    // paso quedan archivos huérfanos, que es el estado previo a este arreglo.
    // Al revés —borrar archivos y que falle la transacción— dejaría un proyecto
    // vivo con sus fotos destruidas, y eso no se deshace.
    await prisma.$transaction([
      prisma.proyecto.delete({ where: { id: proyecto.id } }),
      prisma.auditLog.deleteMany({ where: { proyecto_id: proyecto.id } }),
    ]);

    // Best-effort: `borrarArchivos` nunca lanza. El proyecto ya está borrado y
    // la respuesta no puede depender de Storage.
    await borrarArchivos(archivos);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("POST /api/proyectos/[id]/eliminar", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
