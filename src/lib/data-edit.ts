import { prisma } from "@/lib/prisma";
import type { EditModeData, TipoUnidadInput, EdificioInput, TareaInput } from "@/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types";

export async function getProyectoForEdit(
  projectId: string,
  constructoraId: string,
): Promise<EditModeData | null> {
  const proyecto = await prisma.proyecto.findUnique({
    where: {
      id: projectId,
      constructora_id: constructoraId,
    },
    include: {
      fases: { orderBy: { orden: "asc" } },
      tipos_unidad: {
        include: {
          unidades: {
            take: 1,
            include: {
              espacios: { orderBy: { nombre: "asc" } },
            },
          },
        },
      },
      edificios: {
        orderBy: { nombre: "asc" },
        include: {
          pisos: {
            orderBy: { numero: "asc" },
            include: {
              unidades: {
                orderBy: { nombre: "asc" },
                include: {
                  tipo_unidad: true,
                  espacios: {
                    orderBy: { nombre: "asc" },
                    include: {
                      tareas: {
                        include: {
                          fase: { select: { id: true, nombre: true, orden: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!proyecto) return null;

  // ── tiposUnidad ──────────────────────────────────────────────────────────
  const tiposUnidad: TipoUnidadInput[] = proyecto.tipos_unidad.map((tipo) => {
    const representativeUnit = tipo.unidades[0];
    const espacios = representativeUnit
      ? representativeUnit.espacios.map((e) => e.nombre)
      : [];

    const metraje_total = representativeUnit?.metraje_total ?? undefined;

    const metrajes_espacios: Record<string, number> = {};
    if (representativeUnit) {
      for (const esp of representativeUnit.espacios) {
        if (esp.metraje != null) {
          metrajes_espacios[esp.nombre] = esp.metraje;
        }
      }
    }

    return {
      id: `db-${tipo.id}`,
      nombre: tipo.nombre,
      espacios,
      ...(metraje_total != null ? { metraje_total } : {}),
      ...(Object.keys(metrajes_espacios).length > 0
        ? { metrajes_espacios }
        : {}),
    };
  });

  // Map from db tipo_unidad id -> local id for lookups
  const tipoIdToLocalId = new Map<string, string>();
  for (const tipo of proyecto.tipos_unidad) {
    tipoIdToLocalId.set(tipo.id, `db-${tipo.id}`);
  }

  // ── edificios (non-zona-comun) ───────────────────────────────────────────
  const edificios: EdificioInput[] = proyecto.edificios
    .filter((e) => !e.es_zona_comun)
    .map((edificio) => {
      // Count units per tipo per floor to reconstruct distribucion.
      // The wizard stores a single count-per-floor (same for every floor),
      // so we take the max across floors for each tipo.
      const countPerTipo = new Map<string, number>();

      for (const piso of edificio.pisos) {
        const floorCounts = new Map<string, number>();
        for (const unidad of piso.unidades) {
          if (unidad.tipo_unidad_id) {
            const localId = tipoIdToLocalId.get(unidad.tipo_unidad_id);
            if (localId) {
              floorCounts.set(localId, (floorCounts.get(localId) ?? 0) + 1);
            }
          }
        }
        for (const [localId, count] of floorCounts) {
          const current = countPerTipo.get(localId) ?? 0;
          if (count > current) countPerTipo.set(localId, count);
        }
      }

      const distribucion: Record<string, number> = {};
      for (const [localId, count] of countPerTipo) {
        distribucion[localId] = count;
      }

      return {
        nombre: edificio.nombre,
        pisos: edificio.num_pisos,
        distribucion,
      };
    });

  // ── fasesSeleccionadas & faseDias ────────────────────────────────────────
  const fasesSeleccionadas = proyecto.fases.map((f) => f.nombre);

  const faseDias: Record<string, number | undefined> = {};
  for (const fase of proyecto.fases) {
    if (fase.tiempo_estimado_dias != null) {
      faseDias[fase.nombre] = fase.tiempo_estimado_dias;
    }
  }

  // ── tareas (deduplicated templates from one representative unit) ─────────
  const tareas: TareaInput[] = [];

  // Find one representative non-zona-comun unit with tasks
  let representativeUnit: (typeof proyecto.edificios)[0]["pisos"][0]["unidades"][0] | null = null;
  for (const edificio of proyecto.edificios) {
    if (edificio.es_zona_comun) continue;
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        const hasTasks = unidad.espacios.some((e) => e.tareas.length > 0);
        if (hasTasks) {
          representativeUnit = unidad;
          break;
        }
      }
      if (representativeUnit) break;
    }
    if (representativeUnit) break;
  }

  if (representativeUnit) {
    const seen = new Set<string>();
    for (const espacio of representativeUnit.espacios) {
      for (const tarea of espacio.tareas) {
        const key = `${tarea.fase.nombre}|${espacio.nombre}|${tarea.nombre}`;
        if (seen.has(key)) continue;
        seen.add(key);

        tareas.push({
          id: `db-${tarea.id}`,
          fase: tarea.fase.nombre,
          espacio: espacio.nombre,
          nombre: tarea.nombre,
          tiempo_acordado_dias: tarea.tiempo_acordado_dias,
          ...(tarea.codigo_referencia ? { codigo_referencia: tarea.codigo_referencia } : {}),
          ...(tarea.marca_linea ? { marca_linea: tarea.marca_linea } : {}),
          ...(tarea.componentes ? { componentes: tarea.componentes } : {}),
        });
      }
    }
  }

  // ── zonas comunes ────────────────────────────────────────────────────────
  const zonaComunEdificios = proyecto.edificios.filter((e) => e.es_zona_comun);
  const tieneZonasComunes = zonaComunEdificios.length > 0;

  const zonasSeleccionadas: string[] = [];
  const metrosZonas: Record<string, number> = {};

  for (const edificio of zonaComunEdificios) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        zonasSeleccionadas.push(unidad.nombre);
        // Get metraje from the unit's first espacio (zonas comunes typically have one espacio)
        for (const espacio of unidad.espacios) {
          if (espacio.metraje != null) {
            metrosZonas[unidad.nombre] = espacio.metraje;
            break;
          }
        }
      }
    }
  }

  // ── metrosEnabled ────────────────────────────────────────────────────────
  let metrosEnabled = false;
  outer: for (const edificio of proyecto.edificios) {
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        for (const espacio of unidad.espacios) {
          if (espacio.metraje != null) {
            metrosEnabled = true;
            break outer;
          }
        }
      }
    }
  }

  // ── dbIdMap ──────────────────────────────────────────────────────────────
  const dbIdMapFases: Record<string, string> = {};
  for (const fase of proyecto.fases) {
    dbIdMapFases[fase.nombre] = fase.id;
  }

  const dbIdMapTiposUnidad: Record<string, string> = {};
  for (const tipo of proyecto.tipos_unidad) {
    dbIdMapTiposUnidad[`db-${tipo.id}`] = tipo.id;
  }

  // ── Return EditModeData ──────────────────────────────────────────────────
  return {
    projectId: proyecto.id,
    nombre: proyecto.nombre,
    subtipo: proyecto.subtipo,
    diasHabiles: proyecto.dias_habiles_semana,
    fechaInicio: proyecto.fecha_inicio?.toISOString().slice(0, 10) ?? "",
    fechaFin: proyecto.fecha_fin_estimada?.toISOString().slice(0, 10) ?? "",
    tiposUnidad,
    edificios,
    fasesSeleccionadas,
    faseDias,
    tareas,
    tieneZonasComunes,
    zonasSeleccionadas,
    metrosEnabled,
    metrosZonas,
    dbIdMap: {
      fases: dbIdMapFases,
      tiposUnidad: dbIdMapTiposUnidad,
    },
  };
}
