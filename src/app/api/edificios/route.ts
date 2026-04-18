import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleProjectIds, canAccessProject, isAnyAdmin } from "@/lib/access";

// GET /api/edificios?proyecto_id=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const proyecto_id = new URL(req.url).searchParams.get("proyecto_id");
    if (!proyecto_id) return NextResponse.json({ error: "proyecto_id requerido" }, { status: 400 });

    // Tenant isolation: verify project belongs to the user's constructora
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyecto_id },
      select: { constructora_id: true },
    });
    if (!proyecto || proyecto.constructora_id !== usuario.constructora_id) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const accessible = await getAccessibleProjectIds(
      usuario.id,
      usuario.constructora_id,
      usuario.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    const edificios = await prisma.edificio.findMany({
      where: { proyecto_id },
      include: {
        pisos: {
          orderBy: { numero: "asc" },
          include: {
            unidades: {
              include: {
                tipo_unidad: true,
                espacios: {
                  include: {
                    tareas: {
                      select: { id: true, estado: true, fase_id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(edificios);
  } catch (error) {
    console.error("GET /api/edificios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/edificios — crear edificio con pisos y unidades
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!currentUser || !isAnyAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json();
    const { proyecto_id, nombre, num_pisos, unidades_por_piso, tipo_unidad_id } = body;

    if (!proyecto_id || !nombre || !num_pisos || !unidades_por_piso) {
      return NextResponse.json(
        { error: "proyecto_id, nombre, num_pisos y unidades_por_piso son requeridos" },
        { status: 400 }
      );
    }

    // Tenant isolation: verify the project belongs to the user's constructora
    const proyectoCheck = await prisma.proyecto.findUnique({
      where: { id: proyecto_id },
      select: { constructora_id: true },
    });
    if (!proyectoCheck || proyectoCheck.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const accessibleCreate = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessibleCreate, proyecto_id)) {
      return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });
    }

    // Crear edificio + pisos + unidades en transacción
    const edificio = await prisma.$transaction(async (tx) => {
      const edificio = await tx.edificio.create({
        data: { proyecto_id, nombre, num_pisos },
      });

      for (let p = 1; p <= num_pisos; p++) {
        const piso = await tx.piso.create({
          data: { edificio_id: edificio.id, numero: p },
        });

        for (let u = 1; u <= unidades_por_piso; u++) {
          const numeroUnidad = `${p}0${u}`.padStart(3, "0");
          await tx.unidad.create({
            data: {
              piso_id: piso.id,
              nombre: numeroUnidad,
              tipo_unidad_id: tipo_unidad_id ?? null,
            },
          });
        }
      }

      return edificio;
    });

    return NextResponse.json(edificio, { status: 201 });
  } catch (error) {
    console.error("POST /api/edificios", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
