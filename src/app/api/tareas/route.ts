import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireUser,
  assertEspacioInTenant,
  tenantTareaWhere,
  tenantErrorResponse,
} from "@/lib/tenant";

// GET /api/tareas?espacio_id=&fase_id=&estado=&asignado_a=
export async function GET(req: NextRequest) {
  try {
    const { constructoraId, usuario } = await requireUser();

    const { searchParams } = new URL(req.url);
    const espacio_id = searchParams.get("espacio_id");
    const fase_id = searchParams.get("fase_id");
    const estado = searchParams.get("estado");
    const asignado_a = searchParams.get("asignado_a");

    const esContratista =
      usuario.rol === "CONTRATISTA_INSTALADOR" ||
      usuario.rol === "CONTRATISTA_LUSTRADOR";

    const tareas = await prisma.tarea.findMany({
      where: {
        ...tenantTareaWhere(constructoraId),
        ...(espacio_id && { espacio_id }),
        ...(fase_id && { fase_id }),
        ...(estado && { estado: estado as never }),
        ...(asignado_a && { asignado_a }),
        // Contratistas solo ven sus propias tareas
        ...(esContratista && { asignado_a: usuario.id }),
      },
      include: {
        espacio: {
          include: { unidad: { include: { piso: { include: { edificio: true } } } } },
        },
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
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("GET /api/tareas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/tareas — crear tarea
export async function POST(req: NextRequest) {
  try {
    const { constructoraId } = await requireUser();

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

    // Verificar que el espacio pertenezca a la constructora del usuario
    await assertEspacioInTenant(espacio_id, constructoraId);

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
    const resp = tenantErrorResponse(error);
    if (resp) return resp;
    console.error("POST /api/tareas", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
