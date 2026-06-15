import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";

const ID_RE = /^[a-z0-9]{20,30}$/;
const MAX_DESCRIPCION = 300;
const MAX_MATERIAL = 200;
const MAX_UNIDAD = 40;
const MAX_FACTURA_URL = 600;
// La columna monto es INTEGER en Postgres (máx 2.147.483.647). Topamos por
// debajo para evitar overflow / 500 silencioso al insertar.
const MAX_MONTO = 2_000_000_000;

/**
 * POST /api/proyectos/[id]/gastos — registrar un gasto de materiales.
 *
 * Permisos: cualquier usuario con acceso al proyecto (dueño/admin o su
 * contratista/obrero asignado). Estado inicial siempre REGISTRADO.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id } = await params;

    // Tenant: el proyecto debe ser de la constructora del usuario.
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
      select: { id: true },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    // Acceso: admins ven todo; contratistas solo proyectos donde tienen tareas.
    const accesibles = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accesibles, proyecto_id)) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }

    const body = (await req.json()) as {
      descripcion?: string;
      monto?: number;
      espacio_id?: string | null;
      tarea_id?: string | null;
      factura_url?: string | null;
      material?: string | null;
      cantidad?: number | null;
      unidad?: string | null;
      precio_unitario?: number | null;
    };

    // ── Validaciones ──────────────────────────────────────────────────────
    const descripcion = typeof body.descripcion === "string" ? body.descripcion.trim() : "";
    if (!descripcion) {
      return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
    }
    if (descripcion.length > MAX_DESCRIPCION) {
      return NextResponse.json({ error: `Descripción máximo ${MAX_DESCRIPCION} caracteres` }, { status: 400 });
    }
    if (typeof body.monto !== "number" || !Number.isFinite(body.monto) || !Number.isInteger(body.monto) || body.monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser un entero mayor a 0" }, { status: 400 });
    }
    if (body.monto > MAX_MONTO) {
      return NextResponse.json({ error: "El monto es demasiado alto" }, { status: 400 });
    }
    // factura_url: solo aceptamos un path subido por ESTE proyecto vía /gastos/upload.
    // Si no, un usuario podría pasar el path de evidencias de otro tenant y la
    // página le generaría una signed URL (lectura cross-tenant).
    if (body.factura_url != null && body.factura_url !== "") {
      if (
        typeof body.factura_url !== "string" ||
        body.factura_url.length > MAX_FACTURA_URL ||
        !body.factura_url.startsWith(`facturas/${proyecto_id}/`)
      ) {
        return NextResponse.json({ error: "factura_url inválida" }, { status: 400 });
      }
    }

    // espacio_id (opcional) — debe pertenecer al mismo proyecto.
    let espacioId: string | null = null;
    if (body.espacio_id != null && body.espacio_id !== "") {
      if (typeof body.espacio_id !== "string" || !ID_RE.test(body.espacio_id)) {
        return NextResponse.json({ error: "espacio_id formato inválido" }, { status: 400 });
      }
      const espacio = await prisma.espacio.findFirst({
        where: {
          id: body.espacio_id,
          unidad: { piso: { edificio: { proyecto_id } } },
        },
        select: { id: true },
      });
      if (!espacio) return NextResponse.json({ error: "Espacio no pertenece al proyecto" }, { status: 400 });
      espacioId = espacio.id;
    }

    // tarea_id (opcional) — debe pertenecer al mismo proyecto.
    let tareaId: string | null = null;
    if (body.tarea_id != null && body.tarea_id !== "") {
      if (typeof body.tarea_id !== "string" || !ID_RE.test(body.tarea_id)) {
        return NextResponse.json({ error: "tarea_id formato inválido" }, { status: 400 });
      }
      const tarea = await prisma.tarea.findFirst({
        where: {
          id: body.tarea_id,
          espacio: { unidad: { piso: { edificio: { proyecto_id } } } },
        },
        select: { id: true },
      });
      if (!tarea) return NextResponse.json({ error: "Tarea no pertenece al proyecto" }, { status: 400 });
      tareaId = tarea.id;
    }

    // Nivel detallado (opcional).
    const material = typeof body.material === "string" && body.material.trim()
      ? body.material.trim().slice(0, MAX_MATERIAL)
      : null;
    let cantidad: number | null = null;
    if (body.cantidad != null) {
      if (typeof body.cantidad !== "number" || !Number.isFinite(body.cantidad) || body.cantidad < 0) {
        return NextResponse.json({ error: "cantidad inválida" }, { status: 400 });
      }
      cantidad = body.cantidad;
    }
    const unidad = typeof body.unidad === "string" && body.unidad.trim()
      ? body.unidad.trim().slice(0, MAX_UNIDAD)
      : null;
    let precioUnitario: number | null = null;
    if (body.precio_unitario != null) {
      if (typeof body.precio_unitario !== "number" || !Number.isInteger(body.precio_unitario) || body.precio_unitario < 0 || body.precio_unitario > MAX_MONTO) {
        return NextResponse.json({ error: "precio_unitario debe ser entero entre 0 y el tope" }, { status: 400 });
      }
      precioUnitario = body.precio_unitario;
    }

    const gasto = await prisma.gasto.create({
      data: {
        proyecto_id,
        espacio_id: espacioId,
        tarea_id: tareaId,
        descripcion: descripcion.slice(0, MAX_DESCRIPCION),
        monto: body.monto,
        factura_url: body.factura_url ?? null,
        estado: "REGISTRADO",
        registrado_por: currentUser.id,
        material,
        cantidad,
        unidad,
        precio_unitario: precioUnitario,
      },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/gastos", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * GET /api/proyectos/[id]/gastos — listar gastos del proyecto.
 * Filtros opcionales: ?espacio_id ?tarea_id ?estado
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: proyecto_id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
      select: { id: true },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const accesibles = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accesibles, proyecto_id)) {
      return NextResponse.json({ error: "No tienes acceso a este proyecto" }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const espacioFiltro = sp.get("espacio_id");
    const tareaFiltro = sp.get("tarea_id");
    const estadoFiltro = sp.get("estado");

    if (espacioFiltro && !ID_RE.test(espacioFiltro)) {
      return NextResponse.json({ error: "espacio_id formato inválido" }, { status: 400 });
    }
    if (tareaFiltro && !ID_RE.test(tareaFiltro)) {
      return NextResponse.json({ error: "tarea_id formato inválido" }, { status: 400 });
    }
    const ESTADOS = ["REGISTRADO", "APROBADO", "RECHAZADO"] as const;
    if (estadoFiltro && !ESTADOS.includes(estadoFiltro as (typeof ESTADOS)[number])) {
      return NextResponse.json({ error: "estado inválido" }, { status: 400 });
    }

    const gastos = await prisma.gasto.findMany({
      where: {
        proyecto_id,
        ...(espacioFiltro ? { espacio_id: espacioFiltro } : {}),
        ...(tareaFiltro ? { tarea_id: tareaFiltro } : {}),
        ...(estadoFiltro ? { estado: estadoFiltro as (typeof ESTADOS)[number] } : {}),
      },
      include: {
        espacio: { select: { id: true, nombre: true } },
        tarea: { select: { id: true, nombre: true } },
        registrador: { select: { id: true, nombre: true } },
        aprobador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: 500,
    });

    return NextResponse.json(gastos);
  } catch (err) {
    console.error("GET /api/proyectos/[id]/gastos", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
