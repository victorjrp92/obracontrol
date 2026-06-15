import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";

const ID_RE = /^[a-z0-9]{20,30}$/;
const MAX_NOTA = 300;
// Columna monto INTEGER (Postgres máx 2.147.483.647); topamos por debajo.
const MAX_MONTO = 2_000_000_000;

/**
 * POST /api/proyectos/[id]/anticipos — registrar dinero entregado al maestro.
 *
 * Body: { monto, entregado_a?, nota?, fecha? }
 * Permisos: cualquier usuario con acceso al proyecto.
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

    const body = (await req.json()) as {
      monto?: number;
      entregado_a?: string | null;
      nota?: string | null;
      fecha?: string | null;
    };

    if (typeof body.monto !== "number" || !Number.isFinite(body.monto) || !Number.isInteger(body.monto) || body.monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser un entero mayor a 0" }, { status: 400 });
    }
    if (body.monto > MAX_MONTO) {
      return NextResponse.json({ error: "El monto es demasiado alto" }, { status: 400 });
    }

    // entregado_a (opcional) — usuario de la misma constructora.
    let entregadoA: string | null = null;
    if (body.entregado_a != null && body.entregado_a !== "") {
      if (typeof body.entregado_a !== "string" || !ID_RE.test(body.entregado_a)) {
        return NextResponse.json({ error: "entregado_a formato inválido" }, { status: 400 });
      }
      const receptor = await prisma.usuario.findFirst({
        where: { id: body.entregado_a, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (!receptor) {
        return NextResponse.json({ error: "El receptor no pertenece a esta constructora" }, { status: 400 });
      }
      entregadoA = receptor.id;
    }

    const nota = typeof body.nota === "string" && body.nota.trim()
      ? body.nota.trim().slice(0, MAX_NOTA)
      : null;

    let fecha: Date | undefined;
    if (body.fecha != null && body.fecha !== "") {
      const d = new Date(body.fecha);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "fecha inválida" }, { status: 400 });
      }
      fecha = d;
    }

    const anticipo = await prisma.anticipo.create({
      data: {
        proyecto_id,
        monto: body.monto,
        entregado_a: entregadoA,
        nota,
        registrado_por: currentUser.id,
        ...(fecha ? { fecha } : {}),
      },
    });

    return NextResponse.json(anticipo, { status: 201 });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/anticipos", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/** GET /api/proyectos/[id]/anticipos — listar anticipos del proyecto. */
export async function GET(
  _req: NextRequest,
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

    const anticipos = await prisma.anticipo.findMany({
      where: { proyecto_id },
      include: {
        receptor: { select: { id: true, nombre: true } },
        registrador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: 500,
    });

    return NextResponse.json(anticipos);
  } catch (err) {
    console.error("GET /api/proyectos/[id]/anticipos", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
