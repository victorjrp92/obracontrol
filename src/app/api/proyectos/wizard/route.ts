import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface WizardPayload {
  // Paso 1
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS";
  dias_habiles_semana: number;
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  // Paso 2 — estructura
  edificios: {
    nombre: string;
    pisos: number;
    unidadesPorPiso: number;
  }[];
  // Paso 3 — espacios y tareas
  espacios: string[]; // espacios que tendrá cada unidad
  fases: string[]; // fases activas (Madera, Obra Blanca)
  tareas: {
    fase: string;
    espacio: string;
    nombre: string;
    tiempo_acordado_dias: number;
    codigo_referencia?: string;
    marca_linea?: string;
    componentes?: string;
    asignado_a?: string; // usuario_id del contratista
  }[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { constructora_id: true, rol: true },
    });
    if (!currentUser || !["ADMIN", "JEFE_OPERACIONES"].includes(currentUser.rol)) {
      return NextResponse.json({ error: "Sin permisos para crear proyectos" }, { status: 403 });
    }

    const body: WizardPayload = await req.json();

    // Validaciones básicas
    if (!body.nombre || !body.subtipo || !body.edificios?.length || !body.espacios?.length || !body.fases?.length) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // Crear todo en una transacción
    const proyectoCreado = await prisma.$transaction(async (tx) => {
      // 1. Proyecto
      const proyecto = await tx.proyecto.create({
        data: {
          constructora_id: currentUser.constructora_id,
          nombre: body.nombre,
          subtipo: body.subtipo,
          dias_habiles_semana: body.dias_habiles_semana ?? 5,
          fecha_inicio: body.fecha_inicio ? new Date(body.fecha_inicio) : null,
          fecha_fin_estimada: body.fecha_fin_estimada ? new Date(body.fecha_fin_estimada) : null,
          estado: "ACTIVO",
        },
      });

      // 2. Fases
      const fasesCreadas: Record<string, string> = {};
      for (let i = 0; i < body.fases.length; i++) {
        const fase = await tx.fase.create({
          data: { proyecto_id: proyecto.id, nombre: body.fases[i], orden: i + 1 },
        });
        fasesCreadas[body.fases[i]] = fase.id;
      }

      // 3. TipoUnidad por defecto
      const tipoUnidad = await tx.tipoUnidad.create({
        data: { proyecto_id: proyecto.id, nombre: "Tipo estándar" },
      });

      // 4. Edificios → Pisos → Unidades → Espacios
      for (const edificioInput of body.edificios) {
        const edificio = await tx.edificio.create({
          data: {
            proyecto_id: proyecto.id,
            nombre: edificioInput.nombre,
            num_pisos: edificioInput.pisos,
          },
        });

        for (let p = 1; p <= edificioInput.pisos; p++) {
          const piso = await tx.piso.create({
            data: { edificio_id: edificio.id, numero: p },
          });

          for (let u = 1; u <= edificioInput.unidadesPorPiso; u++) {
            const unidad = await tx.unidad.create({
              data: {
                piso_id: piso.id,
                nombre: `${p}0${u}`,
                tipo_unidad_id: tipoUnidad.id,
              },
            });

            // Crear cada espacio + sus tareas
            for (const nombreEspacio of body.espacios) {
              const espacio = await tx.espacio.create({
                data: { unidad_id: unidad.id, nombre: nombreEspacio, metraje: 15 },
              });

              // Crear las tareas que correspondan a este espacio
              const tareasDelEspacio = body.tareas.filter((t) => t.espacio === nombreEspacio);
              for (const t of tareasDelEspacio) {
                await tx.tarea.create({
                  data: {
                    espacio_id: espacio.id,
                    fase_id: fasesCreadas[t.fase],
                    nombre: t.nombre,
                    tiempo_acordado_dias: t.tiempo_acordado_dias,
                    codigo_referencia: t.codigo_referencia ?? null,
                    marca_linea: t.marca_linea ?? null,
                    componentes: t.componentes ?? null,
                    asignado_a: t.asignado_a ?? null,
                    estado: "PENDIENTE",
                  },
                });
              }
            }
          }
        }
      }

      return proyecto;
    }, { timeout: 60000 });

    return NextResponse.json(proyectoCreado, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/wizard", error);
    return NextResponse.json({ error: "Error creando proyecto" }, { status: 500 });
  }
}
