import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// GET /api/edificios?proyecto_id=
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const proyecto_id = new URL(req.url).searchParams.get("proyecto_id");
    if (!proyecto_id) return NextResponse.json({ error: "proyecto_id requerido" }, { status: 400 });

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

    const usuario = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { rol_ref: { select: { nivel_acceso: true } } },
    });

    if (!usuario || !["ADMINISTRADOR"].includes(usuario.rol_ref.nivel_acceso)) {
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
