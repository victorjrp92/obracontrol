import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin } from "@/lib/access";

/**
 * Wizard payload — same shape as the creation wizard POST endpoint.
 * For edit mode, tareas come from the payload (not TASK_TEMPLATES).
 */
interface WizardPayload {
  password: string;
  // Paso 1
  nombre: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  dias_habiles_semana: number;
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  // Tipos de unidad
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
    unidadesPorPiso?: number;
    distribucion?: Record<string, number>;
  }[];
  // Paso 3 — espacios y tareas
  espacios: string[];
  fases: (string | { nombre: string; tiempo_estimado_dias?: number })[];
  tareas: {
    fase: string;
    espacio: string;
    nombre: string;
    tiempo_acordado_dias: number;
    codigo_referencia?: string;
    marca_linea?: string;
    componentes?: string;
    asignado_a?: string;
  }[];
  zonas_comunes?: string[];
  zonas_comunes_metrajes?: Record<string, number>;
}

// POST /api/proyectos/[id]/wizard — full project update via wizard diff
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        email: true,
        constructora_id: true,
        rol_ref: { select: { nivel_acceso: true } },
      },
    });
    if (!currentUser || !isGeneralAdmin(currentUser.rol_ref.nivel_acceso)) {
      return NextResponse.json(
        { error: "Solo el administrador general puede editar proyectos via wizard" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body: WizardPayload = await req.json();

    // ── Password verification ────────────────────────────────────────────────
    if (!body.password) {
      return NextResponse.json(
        { error: "Se requiere la contrasena de administrador" },
        { status: 400 },
      );
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: body.password,
    });
    if (signInError) {
      return NextResponse.json({ error: "Contrasena incorrecta" }, { status: 403 });
    }

    // ── Verify project belongs to user's constructora ────────────────────────
    const proyecto = await prisma.proyecto.findFirst({
      where: { id, constructora_id: currentUser.constructora_id },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // ── Basic validations ────────────────────────────────────────────────────
    const esZonasComunes = body.subtipo === "ZONAS_COMUNES";
    if (!body.nombre || !body.subtipo) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }
    if (body.nombre.length < 2 || body.nombre.length > 200) {
      return NextResponse.json({ error: "El nombre debe tener entre 2 y 200 caracteres" }, { status: 400 });
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
        return NextResponse.json(
          { error: "Selecciona al menos una zona comun" },
          { status: 400 },
        );
      }
    } else {
      if (!body.edificios?.length || !body.espacios?.length || !body.fases?.length) {
        return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
      }
    }

    // Normalize fases
    const fasesRaw = Array.isArray(body.fases) ? body.fases : [];
    const fasesNormalized = fasesRaw.map((f) =>
      typeof f === "string" ? { nombre: f } : f,
    );

    // Validate task references
    const fasesInput = fasesNormalized.map((f) => f.nombre);
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

    // Tenant isolation: verify asignado_a IDs
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
          { error: "Uno o mas usuarios asignados no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    // Bound structural counts
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

    // ── Pre-compute helpers (same as POST creation wizard) ───────────────────
    const tareasInput = body.tareas ?? [];
    const tareaCountPerFase: Record<string, number> = {};
    for (const t of tareasInput) {
      tareaCountPerFase[t.fase] = (tareaCountPerFase[t.fase] ?? 0) + 1;
    }

    const faseDiasMap: Record<string, number | undefined> = {};
    for (const f of fasesNormalized) {
      faseDiasMap[f.nombre] = f.tiempo_estimado_dias;
    }

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

    // ── Diff transaction ─────────────────────────────────────────────────────
    const summary = await prisma.$transaction(async (tx) => {
      const stats = {
        proyecto_actualizado: false,
        fases_creadas: 0,
        fases_eliminadas: 0,
        fases_actualizadas: 0,
        tipos_creados: 0,
        tipos_eliminados: 0,
        edificios_creados: 0,
        edificios_eliminados: 0,
        edificios_recreados: 0,
        tareas_creadas: 0,
        tareas_eliminadas: 0,
        tareas_actualizadas: 0,
        zonas_creadas: 0,
        zonas_eliminadas: 0,
      };

      // ── 1. Update project fields ────────────────────────────────────────
      await tx.proyecto.update({
        where: { id, constructora_id: currentUser.constructora_id },
        data: {
          nombre: body.nombre,
          subtipo: body.subtipo,
          dias_habiles_semana: body.dias_habiles_semana ?? 5,
          fecha_inicio: body.fecha_inicio ? new Date(body.fecha_inicio) : null,
          fecha_fin_estimada: body.fecha_fin_estimada
            ? new Date(body.fecha_fin_estimada)
            : null,
        },
      });
      stats.proyecto_actualizado = true;

      // ── 2. Fases diff ───────────────────────────────────────────────────
      const existingFases = await tx.fase.findMany({
        where: { proyecto_id: id },
        orderBy: { orden: "asc" },
      });
      const existingFasesByName = new Map(existingFases.map((f) => [f.nombre, f]));
      const incomingFaseNames = new Set(fasesNormalized.map((f) => f.nombre));

      // Delete removed fases (CASCADE deletes their tareas)
      for (const existing of existingFases) {
        if (!incomingFaseNames.has(existing.nombre)) {
          await tx.fase.delete({ where: { id: existing.id } });
          stats.fases_eliminadas++;
        }
      }

      // Create or update fases
      const fasesMap: Record<string, string> = {};
      for (let i = 0; i < fasesNormalized.length; i++) {
        const faseInput = fasesNormalized[i];
        const existing = existingFasesByName.get(faseInput.nombre);
        if (existing) {
          await tx.fase.update({
            where: { id: existing.id },
            data: {
              orden: i + 1,
              ...(faseInput.tiempo_estimado_dias != null
                ? { tiempo_estimado_dias: faseInput.tiempo_estimado_dias }
                : {}),
            },
          });
          fasesMap[faseInput.nombre] = existing.id;
          stats.fases_actualizadas++;
        } else {
          const created = await tx.fase.create({
            data: {
              proyecto_id: id,
              nombre: faseInput.nombre,
              orden: i + 1,
              ...(faseInput.tiempo_estimado_dias != null
                ? { tiempo_estimado_dias: faseInput.tiempo_estimado_dias }
                : {}),
            },
          });
          fasesMap[faseInput.nombre] = created.id;
          stats.fases_creadas++;
        }
      }

      // ── 3. TipoUnidad diff ──────────────────────────────────────────────
      const existingTipos = await tx.tipoUnidad.findMany({
        where: { proyecto_id: id },
      });
      const existingTiposByName = new Map(existingTipos.map((t) => [t.nombre, t]));

      const incomingTipos = body.tipos_unidad && body.tipos_unidad.length > 0
        ? body.tipos_unidad
        : [{ nombre: "Tipo estandar", espacios: body.espacios }];
      const incomingTipoNames = new Set(incomingTipos.map((t) => t.nombre));

      // Delete removed tipos (unidades referencing them will have tipo_unidad_id set to null via SET NULL on delete, or CASCADE)
      for (const existing of existingTipos) {
        if (!incomingTipoNames.has(existing.nombre)) {
          // Detach unidades first (set tipo_unidad_id to null)
          await tx.unidad.updateMany({
            where: { tipo_unidad_id: existing.id },
            data: { tipo_unidad_id: null },
          });
          await tx.tipoUnidad.delete({ where: { id: existing.id } });
          stats.tipos_eliminados++;
        }
      }

      // Create or keep tipos
      const tipoMap: Record<string, {
        id: string;
        espacios: string[];
        metraje_total?: number;
        metrajes_espacios?: Record<string, number>;
      }> = {};
      for (const tipoInput of incomingTipos) {
        const existing = existingTiposByName.get(tipoInput.nombre);
        if (existing) {
          tipoMap[tipoInput.nombre] = {
            id: existing.id,
            espacios: tipoInput.espacios,
            metraje_total: tipoInput.metraje_total,
            metrajes_espacios: tipoInput.metrajes_espacios,
          };
        } else {
          const created = await tx.tipoUnidad.create({
            data: { proyecto_id: id, nombre: tipoInput.nombre },
          });
          tipoMap[tipoInput.nombre] = {
            id: created.id,
            espacios: tipoInput.espacios,
            metraje_total: tipoInput.metraje_total,
            metrajes_espacios: tipoInput.metrajes_espacios,
          };
          stats.tipos_creados++;
        }
      }

      // ── 4. Edificios diff (non-zona-comun) ──────────────────────────────
      const existingEdificios = await tx.edificio.findMany({
        where: { proyecto_id: id, es_zona_comun: false },
        include: {
          pisos: {
            include: {
              unidades: {
                include: {
                  espacios: true,
                  tipo_unidad: true,
                },
              },
            },
          },
        },
      });
      const existingEdificiosByName = new Map(
        existingEdificios.map((e) => [e.nombre, e]),
      );
      const incomingEdificioNames = new Set(body.edificios.map((e) => e.nombre));

      // Helper: create a full edificio structure (pisos, unidades, espacios, tareas)
      async function createEdificioStructure(
        txInner: typeof tx,
        edificioInput: WizardPayload["edificios"][number],
      ) {
        const edificio = await txInner.edificio.create({
          data: {
            proyecto_id: id,
            nombre: edificioInput.nombre,
            num_pisos: edificioInput.pisos,
          },
        });

        let distribution: [string, number][];
        if (edificioInput.distribucion) {
          distribution = Object.entries(edificioInput.distribucion);
        } else {
          const firstTipo = Object.keys(tipoMap)[0];
          distribution = [[firstTipo, edificioInput.unidadesPorPiso ?? 4]];
        }

        let totalUnitsCreated = 0;
        let totalTareasCreated = 0;

        for (let p = 1; p <= edificioInput.pisos; p++) {
          const piso = await txInner.piso.create({
            data: { edificio_id: edificio.id, numero: p },
          });

          let unitCounter = 1;
          for (const [tipoNombre, count] of distribution) {
            const tipoInfo = tipoMap[tipoNombre];
            if (!tipoInfo || count <= 0) continue;

            for (let u = 0; u < count; u++) {
              const unidad = await txInner.unidad.create({
                data: {
                  piso_id: piso.id,
                  nombre: `${p}0${unitCounter}`,
                  tipo_unidad_id: tipoInfo.id,
                  ...(tipoInfo.metraje_total != null
                    ? { metraje_total: tipoInfo.metraje_total }
                    : {}),
                },
              });
              unitCounter++;
              totalUnitsCreated++;

              for (const nombreEspacio of tipoInfo.espacios) {
                const espacioMetraje =
                  tipoInfo.metrajes_espacios?.[nombreEspacio] ?? 15;
                const espacio = await txInner.espacio.create({
                  data: {
                    unidad_id: unidad.id,
                    nombre: nombreEspacio,
                    metraje: espacioMetraje,
                  },
                });

                const tareasDelEspacio = tareasInput.filter(
                  (t) => t.espacio === nombreEspacio,
                );
                for (const t of tareasDelEspacio) {
                  const faseId = fasesMap[t.fase];
                  if (!faseId) continue;
                  const dias = calcDias(t.tiempo_acordado_dias, t.fase);
                  await txInner.tarea.create({
                    data: {
                      espacio_id: espacio.id,
                      fase_id: faseId,
                      nombre: t.nombre,
                      tiempo_acordado_dias: dias,
                      codigo_referencia: t.codigo_referencia ?? null,
                      marca_linea: t.marca_linea ?? null,
                      componentes: t.componentes ?? null,
                      asignado_a: t.asignado_a ?? null,
                      estado: "PENDIENTE",
                    },
                  });
                  totalTareasCreated++;
                }
              }
            }
          }
        }

        return { totalUnitsCreated, totalTareasCreated };
      }

      // Delete removed edificios (CASCADE deletes pisos -> unidades -> espacios -> tareas)
      for (const existing of existingEdificios) {
        if (!incomingEdificioNames.has(existing.nombre)) {
          await tx.edificio.delete({ where: { id: existing.id } });
          stats.edificios_eliminados++;
        }
      }

      // Track which existing edificios were kept as-is (for tarea template diff later)
      const keptEdificioIds: string[] = [];

      for (const edificioInput of body.edificios) {
        const existing = existingEdificiosByName.get(edificioInput.nombre);
        if (!existing) {
          // New edificio — create with full structure
          const result = await createEdificioStructure(tx, edificioInput);
          stats.edificios_creados++;
          stats.tareas_creadas += result.totalTareasCreated;
        } else {
          // Existing edificio — check if structure changed
          const pisosChanged = existing.num_pisos !== edificioInput.pisos;

          // Check distribution change
          let incomingDist: [string, number][];
          if (edificioInput.distribucion) {
            incomingDist = Object.entries(edificioInput.distribucion);
          } else {
            const firstTipo = Object.keys(tipoMap)[0];
            incomingDist = [[firstTipo, edificioInput.unidadesPorPiso ?? 4]];
          }

          // Build existing distribution from actual data
          let distributionChanged = false;
          if (!pisosChanged && existing.pisos.length > 0) {
            const existingPiso = existing.pisos[0];
            const existingDistMap: Record<string, number> = {};
            for (const unidad of existingPiso.unidades) {
              const tipoName = unidad.tipo_unidad?.nombre ?? "Tipo estandar";
              existingDistMap[tipoName] = (existingDistMap[tipoName] ?? 0) + 1;
            }

            const incomingDistMap: Record<string, number> = {};
            for (const [name, count] of incomingDist) {
              incomingDistMap[name] = count;
            }

            // Compare
            const allKeys = new Set([
              ...Object.keys(existingDistMap),
              ...Object.keys(incomingDistMap),
            ]);
            for (const key of allKeys) {
              if ((existingDistMap[key] ?? 0) !== (incomingDistMap[key] ?? 0)) {
                distributionChanged = true;
                break;
              }
            }
          }

          if (pisosChanged || distributionChanged) {
            // Delete all pisos and recreate (V1 aggressive strategy)
            await tx.edificio.update({
              where: { id: existing.id },
              data: { num_pisos: edificioInput.pisos },
            });
            // Delete all pisos (CASCADE removes unidades -> espacios -> tareas)
            await tx.piso.deleteMany({ where: { edificio_id: existing.id } });

            // Recreate structure under the existing edificio
            let recDist: [string, number][];
            if (edificioInput.distribucion) {
              recDist = Object.entries(edificioInput.distribucion);
            } else {
              const firstTipo = Object.keys(tipoMap)[0];
              recDist = [[firstTipo, edificioInput.unidadesPorPiso ?? 4]];
            }

            let totalTareasCreated = 0;
            for (let p = 1; p <= edificioInput.pisos; p++) {
              const piso = await tx.piso.create({
                data: { edificio_id: existing.id, numero: p },
              });

              let unitCounter = 1;
              for (const [tipoNombre, count] of recDist) {
                const tipoInfo = tipoMap[tipoNombre];
                if (!tipoInfo || count <= 0) continue;

                for (let u = 0; u < count; u++) {
                  const unidad = await tx.unidad.create({
                    data: {
                      piso_id: piso.id,
                      nombre: `${p}0${unitCounter}`,
                      tipo_unidad_id: tipoInfo.id,
                      ...(tipoInfo.metraje_total != null
                        ? { metraje_total: tipoInfo.metraje_total }
                        : {}),
                    },
                  });
                  unitCounter++;

                  for (const nombreEspacio of tipoInfo.espacios) {
                    const espacioMetraje =
                      tipoInfo.metrajes_espacios?.[nombreEspacio] ?? 15;
                    const espacio = await tx.espacio.create({
                      data: {
                        unidad_id: unidad.id,
                        nombre: nombreEspacio,
                        metraje: espacioMetraje,
                      },
                    });

                    const tareasDelEspacio = tareasInput.filter(
                      (t) => t.espacio === nombreEspacio,
                    );
                    for (const t of tareasDelEspacio) {
                      const faseId = fasesMap[t.fase];
                      if (!faseId) continue;
                      const dias = calcDias(t.tiempo_acordado_dias, t.fase);
                      await tx.tarea.create({
                        data: {
                          espacio_id: espacio.id,
                          fase_id: faseId,
                          nombre: t.nombre,
                          tiempo_acordado_dias: dias,
                          codigo_referencia: t.codigo_referencia ?? null,
                          marca_linea: t.marca_linea ?? null,
                          componentes: t.componentes ?? null,
                          asignado_a: t.asignado_a ?? null,
                          estado: "PENDIENTE",
                        },
                      });
                      totalTareasCreated++;
                    }
                  }
                }
              }
            }

            stats.edificios_recreados++;
            stats.tareas_creadas += totalTareasCreated;
          } else {
            // Structure unchanged — keep edificio as-is, handle tarea templates later
            keptEdificioIds.push(existing.id);
          }
        }
      }

      // ── 5. Tarea templates diff (for kept edificios) ────────────────────
      for (const edificioId of keptEdificioIds) {
        // Get one representative piso and unit per tipo to detect existing templates
        const pisosForEdificio = await tx.piso.findMany({
          where: { edificio_id: edificioId },
          include: {
            unidades: {
              include: {
                tipo_unidad: true,
                espacios: {
                  include: {
                    tareas: {
                      select: {
                        id: true,
                        nombre: true,
                        espacio: { select: { nombre: true } },
                        fase: { select: { nombre: true } },
                        tiempo_acordado_dias: true,
                        estado: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (pisosForEdificio.length === 0) continue;

        // Get a representative unit (first unit of first piso) to read existing tarea templates
        const representativeUnit = pisosForEdificio[0]?.unidades[0];
        if (!representativeUnit) continue;

        // Build existing tarea template keys: "fase|espacio|nombre"
        const existingTemplates = new Map<string, {
          nombre: string;
          espacio: string;
          fase: string;
          tiempo_acordado_dias: number;
        }>();

        for (const espacio of representativeUnit.espacios) {
          for (const tarea of espacio.tareas) {
            const key = `${tarea.fase.nombre}|${espacio.nombre}|${tarea.nombre}`;
            existingTemplates.set(key, {
              nombre: tarea.nombre,
              espacio: espacio.nombre,
              fase: tarea.fase.nombre,
              tiempo_acordado_dias: tarea.tiempo_acordado_dias,
            });
          }
        }

        // Build incoming tarea template keys
        const incomingTemplates = new Map<string, {
          nombre: string;
          espacio: string;
          fase: string;
          tiempo_acordado_dias: number;
          codigo_referencia?: string;
          marca_linea?: string;
          componentes?: string;
          asignado_a?: string;
        }>();
        for (const t of tareasInput) {
          const key = `${t.fase}|${t.espacio}|${t.nombre}`;
          incomingTemplates.set(key, t);
        }

        // Find templates to add (in incoming but not existing)
        for (const [key, template] of incomingTemplates) {
          if (!existingTemplates.has(key)) {
            // Create this tarea across ALL matching units in this edificio
            const faseId = fasesMap[template.fase];
            if (!faseId) continue;
            const dias = calcDias(template.tiempo_acordado_dias, template.fase);

            for (const piso of pisosForEdificio) {
              for (const unidad of piso.unidades) {
                // Find matching espacio in this unit
                const espacioTarget = unidad.espacios.find(
                  (e) => e.nombre === template.espacio,
                );
                if (!espacioTarget) continue;

                await tx.tarea.create({
                  data: {
                    espacio_id: espacioTarget.id,
                    fase_id: faseId,
                    nombre: template.nombre,
                    tiempo_acordado_dias: dias,
                    codigo_referencia: template.codigo_referencia ?? null,
                    marca_linea: template.marca_linea ?? null,
                    componentes: template.componentes ?? null,
                    asignado_a: template.asignado_a ?? null,
                    estado: "PENDIENTE",
                  },
                });
                stats.tareas_creadas++;
              }
            }
          }
        }

        // Find templates to remove (in existing but not incoming)
        for (const [key, template] of existingTemplates) {
          if (!incomingTemplates.has(key)) {
            // Delete across all units — only PENDIENTE ones
            for (const piso of pisosForEdificio) {
              for (const unidad of piso.unidades) {
                const espacioTarget = unidad.espacios.find(
                  (e) => e.nombre === template.espacio,
                );
                if (!espacioTarget) continue;

                const tareasToDelete = espacioTarget.tareas.filter(
                  (t) =>
                    t.nombre === template.nombre &&
                    t.fase.nombre === template.fase &&
                    t.estado === "PENDIENTE",
                );

                for (const t of tareasToDelete) {
                  await tx.tarea.delete({ where: { id: t.id } });
                  stats.tareas_eliminadas++;
                }
              }
            }
          }
        }

        // Find templates with changed tiempo_acordado_dias
        for (const [key, incoming] of incomingTemplates) {
          const existing = existingTemplates.get(key);
          if (!existing) continue;
          const newDias = calcDias(incoming.tiempo_acordado_dias, incoming.fase);
          if (newDias === existing.tiempo_acordado_dias) continue;

          // Update across all units — only PENDIENTE
          for (const piso of pisosForEdificio) {
            for (const unidad of piso.unidades) {
              const espacioTarget = unidad.espacios.find(
                (e) => e.nombre === incoming.espacio,
              );
              if (!espacioTarget) continue;

              const tareasToUpdate = espacioTarget.tareas.filter(
                (t) =>
                  t.nombre === incoming.nombre &&
                  t.fase.nombre === incoming.fase &&
                  t.estado === "PENDIENTE",
              );

              for (const t of tareasToUpdate) {
                await tx.tarea.update({
                  where: { id: t.id },
                  data: { tiempo_acordado_dias: newDias },
                });
                stats.tareas_actualizadas++;
              }
            }
          }
        }
      }

      // ── 6. Zonas comunes diff ───────────────────────────────────────────
      const existingZCEdificio = await tx.edificio.findFirst({
        where: { proyecto_id: id, es_zona_comun: true },
        include: {
          pisos: {
            include: {
              unidades: {
                include: {
                  espacios: true,
                },
              },
            },
          },
        },
      });

      const incomingZonas = body.zonas_comunes ?? [];

      if (incomingZonas.length > 0) {
        // Ensure "Zonas Comunes" fase exists
        let faseZonasId = fasesMap["Zonas Comunes"];
        if (!faseZonasId) {
          const faseZonas = await tx.fase.create({
            data: {
              proyecto_id: id,
              nombre: "Zonas Comunes",
              orden: fasesNormalized.length + 1,
            },
          });
          faseZonasId = faseZonas.id;
          fasesMap["Zonas Comunes"] = faseZonasId;
        }

        if (existingZCEdificio) {
          // Diff existing zonas vs incoming
          const existingZonaNames = new Set(
            existingZCEdificio.pisos.flatMap((p) =>
              p.unidades.map((u) => u.nombre),
            ),
          );
          const incomingZonaNames = new Set(incomingZonas);

          // Find the piso (there should be exactly one, piso 0)
          let pisoZC = existingZCEdificio.pisos[0];
          if (!pisoZC) {
            pisoZC = await tx.piso.create({
              data: { edificio_id: existingZCEdificio.id, numero: 0 },
            }) as typeof pisoZC;
          }

          // Delete removed zonas
          for (const piso of existingZCEdificio.pisos) {
            for (const unidad of piso.unidades) {
              if (!incomingZonaNames.has(unidad.nombre)) {
                await tx.unidad.delete({ where: { id: unidad.id } });
                stats.zonas_eliminadas++;
              }
            }
          }

          // Create new zonas
          for (const nombreZona of incomingZonas) {
            if (!existingZonaNames.has(nombreZona)) {
              const unidadZC = await tx.unidad.create({
                data: { piso_id: pisoZC.id, nombre: nombreZona },
              });

              const zcMetraje = body.zonas_comunes_metrajes?.[nombreZona];
              const espacioZC = await tx.espacio.create({
                data: {
                  unidad_id: unidadZC.id,
                  nombre: nombreZona,
                  ...(zcMetraje != null ? { metraje: zcMetraje } : {}),
                },
              });

              // Create tareas from payload for this zona
              const tareasZC = tareasInput.filter(
                (t) => t.espacio === nombreZona,
              );
              for (const t of tareasZC) {
                const dias = calcDias(t.tiempo_acordado_dias, t.fase);
                const faseId = fasesMap[t.fase] ?? faseZonasId;
                await tx.tarea.create({
                  data: {
                    espacio_id: espacioZC.id,
                    fase_id: faseId,
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

              stats.zonas_creadas++;
            }
          }
        } else {
          // No existing ZC edificio — create from scratch
          const edificioZC = await tx.edificio.create({
            data: {
              proyecto_id: id,
              nombre: "Zonas Comunes",
              num_pisos: 1,
              es_zona_comun: true,
            },
          });

          const pisoZC = await tx.piso.create({
            data: { edificio_id: edificioZC.id, numero: 0 },
          });

          for (const nombreZona of incomingZonas) {
            const unidadZC = await tx.unidad.create({
              data: { piso_id: pisoZC.id, nombre: nombreZona },
            });

            const zcMetraje = body.zonas_comunes_metrajes?.[nombreZona];
            const espacioZC = await tx.espacio.create({
              data: {
                unidad_id: unidadZC.id,
                nombre: nombreZona,
                ...(zcMetraje != null ? { metraje: zcMetraje } : {}),
              },
            });

            const tareasZC = tareasInput.filter(
              (t) => t.espacio === nombreZona,
            );
            for (const t of tareasZC) {
              const dias = calcDias(t.tiempo_acordado_dias, t.fase);
              const faseId = fasesMap[t.fase] ?? faseZonasId;
              await tx.tarea.create({
                data: {
                  espacio_id: espacioZC.id,
                  fase_id: faseId,
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

            stats.zonas_creadas++;
          }
        }
      } else if (existingZCEdificio) {
        // No incoming zonas but existing ZC edificio — remove it
        await tx.edificio.delete({ where: { id: existingZCEdificio.id } });
        stats.zonas_eliminadas += existingZCEdificio.pisos.reduce(
          (acc, p) => acc + p.unidades.length,
          0,
        );
      }

      return stats;
    }, { timeout: 60000 });

    return NextResponse.json({ updated: true, summary });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/wizard", err);
    return NextResponse.json({ error: "Error actualizando proyecto" }, { status: 500 });
  }
}
