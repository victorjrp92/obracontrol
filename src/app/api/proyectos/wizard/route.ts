import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TASK_TEMPLATES } from "@/lib/task-templates";
import { isGeneralAdmin } from "@/lib/access";

interface WizardPayload {
  // Paso 1
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  dias_habiles_semana: number;
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  // Tipos de unidad (optional for backward compat)
  tipos_unidad?: {
    nombre: string;
    espacios: string[];
    metraje_total?: number;
    metrajes_espacios?: Record<string, number>;
  }[];
  // Paso 2 — estructura
  edificios: {
    nombre: string;
    pisos: number;
    unidadesPorPiso?: number; // legacy
    distribucion?: Record<string, number>; // tipo nombre -> count per floor
  }[];
  // Paso 3 — espacios y tareas
  espacios: string[]; // espacios que tendrá cada unidad (union of all tipos)
  fases: (string | { nombre: string; tiempo_estimado_dias?: number })[]; // backward-compatible
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
  zonas_comunes_metrajes?: Record<string, number>;
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
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json({ error: "Sin permisos para crear proyectos" }, { status: 403 });
    }

    const body: WizardPayload = await req.json();

    // Validaciones básicas
    const esZonasComunes = body.subtipo === "ZONAS_COMUNES";
    if (!body.nombre || !body.subtipo) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }
    if (
      body.dias_habiles_semana != null &&
      (typeof body.dias_habiles_semana !== "number" ||
        body.dias_habiles_semana < 1 ||
        body.dias_habiles_semana > 7)
    ) {
      return NextResponse.json(
        { error: "Dias habiles por semana debe estar entre 1 y 7" },
        { status: 400 },
      );
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

    // Normalize fases: accept string[] or { nombre, tiempo_estimado_dias }[]
    const fasesRaw = Array.isArray(body.fases) ? body.fases : [];
    const fasesNormalized = fasesRaw.map((f) =>
      typeof f === "string" ? { nombre: f } : f
    );
    const fasesInput = fasesNormalized.map((f) => f.nombre);

    // Validate task references: each tarea.fase must be in fasesInput
    for (const t of body.tareas ?? []) {
      if (!fasesInput.includes(t.fase)) {
        return NextResponse.json(
          { error: `La tarea "${t.nombre}" referencia la fase "${t.fase}" que no fue seleccionada` },
          { status: 400 },
        );
      }
      if (typeof t.tiempo_acordado_dias === "number" && t.tiempo_acordado_dias < 0) {
        return NextResponse.json(
          { error: `La tarea "${t.nombre}" tiene dias negativos` },
          { status: 400 },
        );
      }
    }

    // Tenant isolation: verify all `asignado_a` user IDs referenced in tareas
    // belong to the caller's constructora. Otherwise a malicious admin could
    // assign tasks to users of another tenant via cross-tenant IDs.
    const asignadoIds = Array.from(
      new Set(
        (body.tareas ?? [])
          .map((t) => t.asignado_a)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    if (asignadoIds.length > 0) {
      const validos = await prisma.usuario.findMany({
        where: { id: { in: asignadoIds }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (validos.length !== asignadoIds.length) {
        return NextResponse.json(
          { error: "Uno o más usuarios asignados no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    // Bound structural counts to prevent DoS via huge row creation.
    const MAX_EDIFICIOS = 50;
    const MAX_PISOS = 200;
    const MAX_UNIDADES_POR_PISO = 200;
    if (Array.isArray(body.edificios)) {
      if (body.edificios.length > MAX_EDIFICIOS) {
        return NextResponse.json(
          { error: `Maximo ${MAX_EDIFICIOS} edificios por proyecto` },
          { status: 400 },
        );
      }
      for (const ed of body.edificios) {
        if (typeof ed.pisos !== "number" || ed.pisos < 1 || ed.pisos > MAX_PISOS) {
          return NextResponse.json(
            { error: `El numero de pisos debe estar entre 1 y ${MAX_PISOS}` },
            { status: 400 },
          );
        }
        if (ed.unidadesPorPiso !== undefined) {
          if (ed.unidadesPorPiso < 1 || ed.unidadesPorPiso > MAX_UNIDADES_POR_PISO) {
            return NextResponse.json(
              { error: `Las unidades por piso deben estar entre 1 y ${MAX_UNIDADES_POR_PISO}` },
              { status: 400 },
            );
          }
        }
        if (ed.distribucion) {
          const total = Object.values(ed.distribucion).reduce(
            (a, b) => a + (typeof b === "number" ? b : 0),
            0,
          );
          if (total > MAX_UNIDADES_POR_PISO) {
            return NextResponse.json(
              { error: `La distribucion por piso no puede superar ${MAX_UNIDADES_POR_PISO} unidades` },
              { status: 400 },
            );
          }
        }
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
      const faseDiasMap: Record<string, number | undefined> = {};
      for (let i = 0; i < fasesNormalized.length; i++) {
        const faseInput = fasesNormalized[i];
        const fase = await tx.fase.create({
          data: {
            proyecto_id: proyecto.id,
            nombre: faseInput.nombre,
            orden: i + 1,
            ...(faseInput.tiempo_estimado_dias != null
              ? { tiempo_estimado_dias: faseInput.tiempo_estimado_dias }
              : {}),
          },
        });
        fasesCreadas[faseInput.nombre] = fase.id;
        faseDiasMap[faseInput.nombre] = faseInput.tiempo_estimado_dias;
      }

      // 3. Tipos de unidad
      const tipoMap: Record<string, {
        id: string;
        espacios: string[];
        metraje_total?: number;
        metrajes_espacios?: Record<string, number>;
      }> = {};
      if (body.tipos_unidad && body.tipos_unidad.length > 0) {
        for (const tipoInput of body.tipos_unidad) {
          const created = await tx.tipoUnidad.create({
            data: { proyecto_id: proyecto.id, nombre: tipoInput.nombre },
          });
          tipoMap[tipoInput.nombre] = {
            id: created.id,
            espacios: tipoInput.espacios,
            metraje_total: tipoInput.metraje_total,
            metrajes_espacios: tipoInput.metrajes_espacios,
          };
        }
      } else {
        // Legacy: single default type with all spaces
        const created = await tx.tipoUnidad.create({
          data: { proyecto_id: proyecto.id, nombre: "Tipo estándar" },
        });
        tipoMap["Tipo estándar"] = { id: created.id, espacios: body.espacios };
      }

      // Pre-compute tarea counts per fase for auto-calculation
      const tareasInput = body.tareas ?? [];
      const tareaCountPerFase: Record<string, number> = {};
      for (const t of tareasInput) {
        tareaCountPerFase[t.fase] = (tareaCountPerFase[t.fase] ?? 0) + 1;
      }

      // Calculate total project days from dates (fallback)
      let totalProjectDias: number | null = null;
      if (body.fecha_inicio && body.fecha_fin_estimada) {
        const start = new Date(body.fecha_inicio);
        const end = new Date(body.fecha_fin_estimada);
        const diffMs = end.getTime() - start.getTime();
        totalProjectDias = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
      const numFases = fasesNormalized.length || 1;

      function calcDias(original: number, faseName: string): number {
        if (original > 0) return original;
        const diasFase = faseDiasMap[faseName];
        const numTareas = tareaCountPerFase[faseName] || 1;
        if (diasFase != null && diasFase > 0) {
          return Math.max(1, Math.round(diasFase / numTareas));
        }
        if (totalProjectDias != null) {
          return Math.max(1, Math.round(totalProjectDias / numFases / numTareas));
        }
        return 3;
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
                  ...(tipoInfo.metraje_total != null ? { metraje_total: tipoInfo.metraje_total } : {}),
                },
              });
              unitCounter++;

              // Only create spaces that belong to this unit's type
              for (const nombreEspacio of tipoInfo.espacios) {
                const espacioMetraje = tipoInfo.metrajes_espacios?.[nombreEspacio] ?? 15;
                const espacio = await tx.espacio.create({
                  data: { unidad_id: unidad.id, nombre: nombreEspacio, metraje: espacioMetraje },
                });

                // Create tasks for this space
                const tareasDelEspacio = (body.tareas ?? []).filter((t) => t.espacio === nombreEspacio);
                for (const t of tareasDelEspacio) {
                  const dias = calcDias(t.tiempo_acordado_dias, t.fase);
                  await tx.tarea.create({
                    data: {
                      espacio_id: espacio.id,
                      fase_id: fasesCreadas[t.fase],
                      nombre: t.nombre,
                      tiempo_acordado_dias: dias,
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
              orden: fasesInput.length + 1,
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
          const zcMetraje = body.zonas_comunes_metrajes?.[nombreZona];
          const espacioZC = await tx.espacio.create({
            data: {
              unidad_id: unidadZC.id,
              nombre: nombreZona,
              ...(zcMetraje != null ? { metraje: zcMetraje } : {}),
            },
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
  } catch {
    return NextResponse.json({ error: "Error creando proyecto" }, { status: 500 });
  }
}
