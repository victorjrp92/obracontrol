import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject, canApproveTasks } from "@/lib/access";

// GET /api/tareas?espacio_id=&fase_id=&estado=&asignado_a=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );

    const { searchParams } = new URL(req.url);
    const espacio_id = searchParams.get("espacio_id");
    const fase_id = searchParams.get("fase_id");
    const estado = searchParams.get("estado");
    const asignado_a = searchParams.get("asignado_a");

    const tareas = await prisma.tarea.findMany({
      where: {
        // Tenant isolation: only tasks from this constructora
        espacio: {
          unidad: {
            piso: {
              edificio: {
                proyecto: {
                  constructora_id: usuario.constructora_id,
                  ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
                },
              },
            },
          },
        },
        ...(espacio_id && { espacio_id }),
        ...(fase_id && { fase_id }),
        ...(estado && { estado: estado as never }),
        ...(asignado_a && { asignado_a }),
      },
      include: {
        espacio: { include: { unidad: { include: { piso: { include: { edificio: true } } } } } },
        fase: true,
        asignado_usuario: { select: { id: true, nombre: true, email: true } },
        evidencias: { orderBy: { created_at: "desc" }, take: 4 },
        aprobaciones: { orderBy: { fecha: "desc" }, take: 1 },
        checklist_respuesta: true,
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json(tareas);
  } catch (error) {
    console.error("GET /api/tareas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/tareas — crear tarea
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || !canApproveTasks(usuario.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para crear tareas" }, { status: 403 });
    }

    const body = await req.json();
    const {
      espacio_id, fase_id, nombre, tiempo_acordado_dias,
      codigo_referencia, nombre_pieza, marca_linea, componentes,
      cantidad_material_planeada, unidad_material, asignado_a, depende_de,
    } = body;

    if (!espacio_id || !fase_id || !nombre || !tiempo_acordado_dias) {
      return NextResponse.json(
        { error: "espacio_id, fase_id, nombre y tiempo_acordado_dias son requeridos" },
        { status: 400 }
      );
    }

    // Tenant isolation: verify the espacio belongs to this constructora
    const espacio = await prisma.espacio.findUnique({
      where: { id: espacio_id },
      select: { unidad: { select: { piso: { select: { edificio: { select: { proyecto: { select: { constructora_id: true } } } } } } } } },
    });

    if (!espacio || espacio.unidad.piso.edificio.proyecto.constructora_id !== usuario.constructora_id) {
      return NextResponse.json({ error: "Espacio no encontrado" }, { status: 404 });
    }

    const accessibleCreate = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    const espacioProyectoId = await prisma.proyecto.findFirst({
      where: {
        edificios: { some: { pisos: { some: { unidades: { some: { espacios: { some: { id: espacio_id } } } } } } } },
      },
      select: { id: true },
    });
    if (!espacioProyectoId || !canAccessProject(accessibleCreate, espacioProyectoId.id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    // Tenant isolation: verify fase_id belongs to the same constructora/project
    const faseOwned = await prisma.fase.findFirst({
      where: { id: fase_id, proyecto_id: espacioProyectoId.id },
      select: { id: true },
    });
    if (!faseOwned) {
      return NextResponse.json({ error: "Fase no encontrada" }, { status: 400 });
    }

    // Tenant isolation: verify asignado_a (if provided) belongs to the same constructora
    if (asignado_a) {
      const assignee = await prisma.usuario.findFirst({
        where: { id: asignado_a, constructora_id: usuario.constructora_id },
        select: { id: true },
      });
      if (!assignee) {
        return NextResponse.json({ error: "Usuario asignado no válido" }, { status: 400 });
      }
    }

    // Tenant isolation: verify depende_de (if provided) belongs to a task in the same constructora
    if (depende_de) {
      const dep = await prisma.tarea.findFirst({
        where: {
          id: depende_de,
          espacio: {
            unidad: { piso: { edificio: { proyecto: { constructora_id: usuario.constructora_id } } } },
          },
        },
        select: { id: true },
      });
      if (!dep) {
        return NextResponse.json({ error: "Dependencia no válida" }, { status: 400 });
      }
    }

    const tarea = await prisma.tarea.create({
      data: {
        espacio_id, fase_id, nombre,
        tiempo_acordado_dias: Number(tiempo_acordado_dias),
        codigo_referencia, nombre_pieza, marca_linea, componentes,
        cantidad_material_planeada: cantidad_material_planeada ? Number(cantidad_material_planeada) : null,
        unidad_material, asignado_a, depende_de,
      },
    });

    return NextResponse.json(tarea, { status: 201 });
  } catch (error) {
    console.error("POST /api/tareas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
