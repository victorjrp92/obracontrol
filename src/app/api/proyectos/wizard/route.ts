import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TASK_TEMPLATES } from "@/lib/task-templates";

interface WizardPayload {
  // Paso 1
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  dias_habiles_semana: number;
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  // Tipos de unidad (optional for backward compat)
  tipos_unidad?: { nombre: string; espacios: string[] }[];
  // Paso 2 — estructura
  edificios: {
    nombre: string;
    pisos: number;
    unidadesPorPiso?: number; // legacy
    distribucion?: Record<string, number>; // tipo nombre -> count per floor
  }[];
  // Paso 3 — espacios y tareas
  espacios: string[]; // espacios que tendrá cada unidad (union of all tipos)
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
  zonas_comunes?: string[]; // nombres de zonas comunes seleccionadas
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
      select: { constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser || !["ADMINISTRADOR"].includes(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para crear proyectos" }, { status: 403 });
    }

    const body: WizardPayload = await req.json();

    // Validaciones básicas
    const esZonasComunes = body.subtipo === "ZONAS_COMUNES";
    if (!body.nombre || !body.subtipo) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }
    if (esZonasComunes) {
      if (!body.zonas_comunes?.length) {
        return NextResponse.json({ error: "Selecciona al menos una zona comun" }, { status: 400 });
      }
    } else {
      if (!body.edificios?.length || !body.espacios?.length || !body.fases?.length) {
        return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
      }
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

      // 3. Tipos de unidad
      const tipoMap: Record<string, { id: string; espacios: string[] }> = {};
      if (body.tipos_unidad && body.tipos_unidad.length > 0) {
        for (const tipoInput of body.tipos_unidad) {
          const created = await tx.tipoUnidad.create({
            data: { proyecto_id: proyecto.id, nombre: tipoInput.nombre },
          });
          tipoMap[tipoInput.nombre] = { id: created.id, espacios: tipoInput.espacios };
        }
      } else {
        // Legacy: single default type with all spaces
        const created = await tx.tipoUnidad.create({
          data: { proyecto_id: proyecto.id, nombre: "Tipo estándar" },
        });
        tipoMap["Tipo estándar"] = { id: created.id, espacios: body.espacios };
      }

      // 4. Edificios → Pisos → Unidades → Espacios
      for (const edificioInput of body.edificios) {
        const edificio = await tx.edificio.create({
          data: {
            proyecto_id: proyecto.id,
            nombre: edificioInput.nombre,
            num_pisos: edificioInput.pisos,
          },
        });

        // Build distribution: tipo name -> count per floor
        let distribution: [string, number][];
        if (edificioInput.distribucion) {
          distribution = Object.entries(edificioInput.distribucion);
        } else {
          // Legacy: all units are the first type
          const firstTipo = Object.keys(tipoMap)[0];
          distribution = [[firstTipo, edificioInput.unidadesPorPiso ?? 4]];
        }

        for (let p = 1; p <= edificioInput.pisos; p++) {
          const piso = await tx.piso.create({
            data: { edificio_id: edificio.id, numero: p },
          });

          let unitCounter = 1;
          for (const [tipoNombre, count] of distribution) {
            const tipoInfo = tipoMap[tipoNombre];
            if (!tipoInfo || count <= 0) continue;

            for (let u = 0; u < count; u++) {
              const unidad = await tx.unidad.create({
                data: {
                  piso_id: piso.id,
                  nombre: `${p}0${unitCounter}`,
                  tipo_unidad_id: tipoInfo.id,
                },
              });
              unitCounter++;

              // Only create spaces that belong to this unit's type
              for (const nombreEspacio of tipoInfo.espacios) {
                const espacio = await tx.espacio.create({
                  data: { unidad_id: unidad.id, nombre: nombreEspacio, metraje: 15 },
                });

                // Create tasks for this space
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
      }

      // 5. Zonas comunes (si aplica)
      const zonasComunes = body.zonas_comunes ?? [];
      if (zonasComunes.length > 0) {
        // Crear una fase "Zonas Comunes" si no existe ya
        let faseZonasId = fasesCreadas["Zonas Comunes"];
        if (!faseZonasId) {
          const faseZonas = await tx.fase.create({
            data: {
              proyecto_id: proyecto.id,
              nombre: "Zonas Comunes",
              orden: body.fases.length + 1,
            },
          });
          faseZonasId = faseZonas.id;
        }

        // Crear el edificio especial de zonas comunes
        const edificioZC = await tx.edificio.create({
          data: {
            proyecto_id: proyecto.id,
            nombre: "Zonas Comunes",
            num_pisos: 1,
            es_zona_comun: true,
          },
        });

        // Un único piso (numero 0)
        const pisoZC = await tx.piso.create({
          data: { edificio_id: edificioZC.id, numero: 0 },
        });

        // Una unidad por zona
        for (const nombreZona of zonasComunes) {
          const unidadZC = await tx.unidad.create({
            data: { piso_id: pisoZC.id, nombre: nombreZona },
          });

          // Crear un espacio con el mismo nombre de la zona
          const espacioZC = await tx.espacio.create({
            data: { unidad_id: unidadZC.id, nombre: nombreZona },
          });

          // Crear tareas desde TASK_TEMPLATES["Zonas Comunes"] si existen para esta zona
          const tareasZC = TASK_TEMPLATES["Zonas Comunes"]?.[nombreZona] ?? [];
          for (const t of tareasZC) {
            await tx.tarea.create({
              data: {
                espacio_id: espacioZC.id,
                fase_id: faseZonasId,
                nombre: t.nombre,
                tiempo_acordado_dias: t.tiempo_acordado_dias,
                estado: "PENDIENTE",
              },
            });
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
