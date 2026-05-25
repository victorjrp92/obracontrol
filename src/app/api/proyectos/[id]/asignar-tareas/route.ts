import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { checkAdminProjectPermission, isAnyAdmin } from "@/lib/access";

const MAX_TAREAS = 2000;
const ID_RE = /^[a-z0-9]{20,30}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Solo administradores pueden asignar tareas" }, { status: 403 });
    }

    const { id: proyecto_id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
      select: { id: true },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const canAssign = await checkAdminProjectPermission(
      currentUser.id,
      proyecto_id,
      "can_assign_contractors",
    );
    if (!canAssign) {
      return NextResponse.json(
        { error: "No tienes permisos para asignar tareas en este proyecto" },
        { status: 403 },
      );
    }

    const contratistas = await prisma.usuario.findMany({
      where: {
        rol_ref: { nivel_acceso: "CONTRATISTA" },
        constructora_id: currentUser.constructora_id,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol_ref: { select: { nombre: true } },
      },
      orderBy: { nombre: "asc" },
    });

    const tareasRaw = await prisma.tarea.findMany({
      where: {
        estado: { in: ["PENDIENTE", "NO_APROBADA"] },
        espacio: {
          unidad: {
            piso: {
              edificio: { proyecto_id },
            },
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        subfase: true,
        estado: true,
        asignado_a: true,
        fase: { select: { nombre: true } },
        asignado_usuario: { select: { nombre: true } },
        espacio: {
          select: {
            nombre: true,
            unidad: {
              select: {
                nombre: true,
                piso: {
                  select: {
                    edificio: { select: { nombre: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ nombre: "asc" }],
    });

    return NextResponse.json({
      contratistas: contratistas.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        rol: c.rol_ref.nombre,
      })),
      tareas: tareasRaw.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        fase: t.fase.nombre,
        subfase: t.subfase,
        espacio: t.espacio.nombre,
        unidad: t.espacio.unidad.nombre,
        edificio: t.espacio.unidad.piso.edificio.nombre,
        estado: t.estado,
        asignado_a: t.asignado_a,
        asignado_a_nombre: t.asignado_usuario?.nombre ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/proyectos/[id]/asignar-tareas", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Solo administradores pueden asignar tareas" }, { status: 403 });
    }

    const { id: proyecto_id } = await params;

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyecto_id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const canAssign = await checkAdminProjectPermission(
      currentUser.id,
      proyecto_id,
      "can_assign_contractors",
    );
    if (!canAssign) {
      return NextResponse.json(
        { error: "No tienes permisos para asignar tareas en este proyecto" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      contratista_id?: string | null;
      tarea_ids?: string[];
      password?: string;
      motivo?: string;
    };

    if (typeof body.password !== "string" || !body.password || body.password.length > 128) {
      return NextResponse.json({ error: "Contraseña requerida (max 128 caracteres)" }, { status: 400 });
    }
    if (!Array.isArray(body.tarea_ids) || body.tarea_ids.length === 0) {
      return NextResponse.json({ error: "tarea_ids es requerido" }, { status: 400 });
    }
    for (const tid of body.tarea_ids) {
      if (typeof tid !== "string" || !ID_RE.test(tid)) {
        return NextResponse.json({ error: "tarea_ids contiene IDs inválidos" }, { status: 400 });
      }
    }
    // Dedupe para evitar 404 confuso si el cliente envía IDs repetidos.
    const tareaIdsUnique = Array.from(new Set(body.tarea_ids));
    if (tareaIdsUnique.length > MAX_TAREAS) {
      return NextResponse.json(
        { error: `Demasiadas tareas (${tareaIdsUnique.length}). Máximo ${MAX_TAREAS} por operación.` },
        { status: 400 },
      );
    }
    if (body.contratista_id != null && body.contratista_id !== "") {
      if (typeof body.contratista_id !== "string" || !ID_RE.test(body.contratista_id)) {
        return NextResponse.json({ error: "contratista_id formato inválido" }, { status: 400 });
      }
    }
    if (body.motivo && body.motivo.length > 500) {
      return NextResponse.json({ error: "Motivo máximo 500 caracteres" }, { status: 400 });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: body.password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 403 });
    }

    const contratistaIdNuevo = body.contratista_id && body.contratista_id !== "" ? body.contratista_id : null;
    if (contratistaIdNuevo) {
      const nuevo = await prisma.usuario.findFirst({
        where: { id: contratistaIdNuevo, constructora_id: currentUser.constructora_id },
        select: { id: true, rol_ref: { select: { nivel_acceso: true } } },
      });
      if (!nuevo) return NextResponse.json({ error: "Contratista no encontrado" }, { status: 404 });
      // Solo usuarios con rol CONTRATISTA pueden ser asignados a tareas — de otro modo
      // un admin u obrero podría recibir tareas, corrompiendo /mis-tareas y el scoring.
      if (nuevo.rol_ref.nivel_acceso !== "CONTRATISTA") {
        return NextResponse.json(
          { error: "El usuario seleccionado no tiene rol de Contratista" },
          { status: 400 },
        );
      }
    }

    const tareas = await prisma.tarea.findMany({
      where: {
        id: { in: tareaIdsUnique },
        espacio: {
          unidad: {
            piso: {
              edificio: {
                proyecto_id,
                proyecto: { constructora_id: currentUser.constructora_id },
              },
            },
          },
        },
      },
      select: { id: true, estado: true, asignado_a: true, nombre: true },
    });

    if (tareas.length !== tareaIdsUnique.length) {
      return NextResponse.json(
        { error: "Una o más tareas no existen o no pertenecen a este proyecto" },
        { status: 404 },
      );
    }

    const bloqueadas = tareas.filter(
      (t) => t.estado !== "PENDIENTE" && t.estado !== "NO_APROBADA",
    );
    if (bloqueadas.length > 0) {
      return NextResponse.json(
        {
          error: "Algunas tareas no se pueden reasignar (estado APROBADA o REPORTADA)",
          bloqueadas: bloqueadas.map((t) => ({ id: t.id, nombre: t.nombre, estado: t.estado })),
        },
        { status: 409 },
      );
    }

    const aActualizar = tareas.filter(
      (t) => (t.asignado_a ?? null) !== contratistaIdNuevo,
    );

    if (aActualizar.length === 0) {
      return NextResponse.json({
        ok: true,
        asignadas: 0,
        mensaje: "Las tareas ya estaban asignadas a ese contratista",
      });
    }

    const ids = aActualizar.map((t) => t.id);
    const anteriores = new Map(aActualizar.map((t) => [t.id, t.asignado_a ?? null]));

    await prisma.$transaction([
      prisma.tarea.updateMany({
        where: { id: { in: ids } },
        data: { asignado_a: contratistaIdNuevo },
      }),
      prisma.reasignacionTarea.createMany({
        data: ids.map((tid) => ({
          tarea_id: tid,
          proyecto_id,
          contratista_anterior_id: anteriores.get(tid) ?? null,
          contratista_nuevo_id: contratistaIdNuevo,
          realizado_por: currentUser.id,
          motivo: body.motivo?.trim() || null,
        })),
      }),
    ]);

    return NextResponse.json({
      ok: true,
      asignadas: ids.length,
      mensaje: `${ids.length} tarea(s) asignada(s) exitosamente`,
    });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/asignar-tareas", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
