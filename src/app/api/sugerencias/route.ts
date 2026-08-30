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

/**
 * Tope de unidades por sugerencia. Una torre grande no llega a 500 unidades en
 * un solo edificio, y el formulario manda las de UNO. El tope está para que un
 * cuerpo fabricado a mano no meta un `in:` de decenas de miles de ids ni un
 * blob de megabytes en la columna Json.
 */
const MAX_UNIDADES_POR_SUGERENCIA = 500;

/**
 * Forma de la ruta que devuelve `POST /api/sugerencias/upload`:
 * `sugerencias/<usuarioId>/<timestamp>.<ext>`. Se exige literalmente porque el
 * panel del administrador pinta ese valor en un `<img src>`.
 */
const RUTA_FOTO_SUGERENCIA = /^sugerencias\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_.-]{1,120}$/;

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
    const { proyecto_id, edificio_id, unidades, nombre, descripcion, foto_url, precio } = body as {
      proyecto_id?: string;
      edificio_id?: string;
      unidades?: unknown;
      nombre?: string;
      descripcion?: string;
      foto_url?: string;
      precio?: number | null;
    };

    if (!proyecto_id || !nombre || !unidades || !Array.isArray(unidades) || unidades.length === 0) {
      return NextResponse.json(
        { error: "proyecto_id, nombre y unidades (array) son requeridos" },
        { status: 400 }
      );
    }

    if (precio !== null && precio !== undefined) {
      if (typeof precio !== "number" || !isFinite(precio) || precio < 0 || precio > 1_000_000_000) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }
    }

    // `unidades` llega como Json: puede traer cualquier cosa. Antes de usarlo en
    // un `in:` de Prisma tiene que ser una lista de ids, sin repetidos y acotada
    // — el formulario manda las unidades de UN edificio, nunca decenas de miles.
    if (unidades.length > MAX_UNIDADES_POR_SUGERENCIA) {
      return NextResponse.json(
        { error: `No se pueden sugerir más de ${MAX_UNIDADES_POR_SUGERENCIA} unidades a la vez` },
        { status: 400 }
      );
    }
    if (!unidades.every((u): u is string => typeof u === "string" && u.trim().length > 0)) {
      return NextResponse.json(
        { error: "unidades debe ser una lista de identificadores" },
        { status: 400 }
      );
    }
    const unidadesIds = [...new Set(unidades.map((u) => u.trim()))];

    // El proyecto tiene que ser del MISMO tenant, y además el contratista tiene
    // que tener tareas en él. Lo primero no se deducía de lo segundo: el conteo
    // de tareas no mira la constructora en ningún punto de la cadena.
    const proyectoDelTenant = await prisma.proyecto.count({
      where: { id: proyecto_id, constructora_id: contratista.constructora_id },
    });
    if (proyectoDelTenant === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
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

    // El edificio se persistía CRUDO: un id de otra obra —o de otra
    // constructora— quedaba guardado sin que nada lo mirase, porque la columna
    // no tiene clave foránea. Hoy no la lee nadie, y por eso justamente hay que
    // cerrarlo aquí: la primera consulta que la use heredaría el agujero.
    const edificioId = typeof edificio_id === "string" && edificio_id.trim() ? edificio_id.trim() : null;
    if (edificioId) {
      const edificioDeLaObra = await prisma.edificio.count({
        where: { id: edificioId, proyecto_id },
      });
      if (edificioDeLaObra === 0) {
        return NextResponse.json(
          { error: "El edificio no pertenece a este proyecto" },
          { status: 400 }
        );
      }
    }

    // Las unidades tienen que colgar de ESTA obra —y del edificio, si se
    // declaró uno—. La ruta de aprobación ya lo comprobaba, pero solo al
    // aprobar: hasta entonces la fila guardaba ids ajenos y el administrador se
    // encontraba el error semanas después, sobre una sugerencia que ya no podía
    // corregir. Se rechaza en el origen, que es donde se sabe.
    const unidadesDeLaObra = await prisma.unidad.count({
      where: {
        id: { in: unidadesIds },
        piso: {
          edificio: {
            proyecto_id,
            ...(edificioId ? { id: edificioId } : {}),
          },
        },
      },
    });
    if (unidadesDeLaObra !== unidadesIds.length) {
      return NextResponse.json(
        { error: "Algunas unidades no pertenecen a este proyecto" },
        { status: 400 }
      );
    }

    // `foto_url` se guarda y después se pinta en el panel del administrador. Lo
    // que se acepta es la ruta que devuelve `POST /api/sugerencias/upload`, no
    // una cadena cualquiera: una URL absoluta metida aquí haría que el navegador
    // del administrador fuera a buscarla a un servidor de terceros.
    const fotoUrl = typeof foto_url === "string" && foto_url.trim() ? foto_url.trim() : null;
    if (fotoUrl && !RUTA_FOTO_SUGERENCIA.test(fotoUrl)) {
      return NextResponse.json({ error: "foto_url inválida" }, { status: 400 });
    }

    const sugerencia = await prisma.tareaSugerida.create({
      data: {
        contratista_id: contratista.id,
        proyecto_id,
        edificio_id: edificioId,
        unidades: unidadesIds,
        nombre,
        descripcion: descripcion ?? null,
        foto_url: fotoUrl,
        precio: precio === null || precio === undefined ? null : Number(precio),
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
