import { prisma } from "@/lib/prisma";
import type { EditModeData, TipoUnidadInput, EdificioInput, TareaInput, DistribucionSentido, AsignacionOverride } from "@/app/(dashboard)/dashboard/proyectos/nuevo/wizard-types";

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
  // Distribución se devuelve como TOTALES DE LA TORRE (suma entre todos los pisos),
  // alineada con la semántica del wizard de creación. unidades_por_piso se deriva
  // del piso con más unidades (asumiendo capacidad uniforme).
  const edificios: EdificioInput[] = proyecto.edificios
    .filter((e) => !e.es_zona_comun)
    .map((edificio) => {
      const towerTotals = new Map<string, DistribucionSentido>();
      let maxUnitsInAnyFloor = 0;

      for (const piso of edificio.pisos) {
        if (piso.unidades.length > maxUnitsInAnyFloor) {
          maxUnitsInAnyFloor = piso.unidades.length;
        }
        for (const unidad of piso.unidades) {
          if (unidad.tipo_unidad_id) {
            const localId = tipoIdToLocalId.get(unidad.tipo_unidad_id);
            if (localId) {
              const prev = towerTotals.get(localId) ?? { derecha: 0, izquierda: 0 };
              const s = (unidad as { sentido?: string | null }).sentido;
              if (s === "izquierda") prev.izquierda++;
              else prev.derecha++;
              towerTotals.set(localId, prev);
            }
          }
        }
      }

      const distribucion: Record<string, DistribucionSentido> = {};
      for (const [localId, counts] of towerTotals) {
        distribucion[localId] = counts;
      }

      return {
        nombre: edificio.nombre,
        pisos: edificio.num_pisos,
        unidades_por_piso: maxUnitsInAnyFloor,
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

  // ── tareas (deduplicated templates por tipo de unidad) ──────────────────
  // Cargamos una unidad representativa POR cada tipo y deduplicamos templates.
  // Tareas de Madera se etiquetan con tipo_unidad_id (local id) y se colapsan
  // las 2 subfases de DB en un único template (subfase=undefined, como las envía
  // el wizard de creación). Tareas no-Madera se mantienen como plantillas únicas
  // (sin tipo_unidad_id) si aparecen idénticas en todos los tipos; si solo
  // aparecen en algunos, se etiquetan con el tipo correspondiente.
  const tareas: TareaInput[] = [];

  // Por cada tipo, buscar la primera unidad de ese tipo con tareas
  const representativePorTipo = new Map<
    string,
    (typeof proyecto.edificios)[0]["pisos"][0]["unidades"][0]
  >();
  for (const edificio of proyecto.edificios) {
    if (edificio.es_zona_comun) continue;
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        if (!unidad.tipo_unidad_id) continue;
        if (representativePorTipo.has(unidad.tipo_unidad_id)) continue;
        const hasTasks = unidad.espacios.some((e) => e.tareas.length > 0);
        if (hasTasks) representativePorTipo.set(unidad.tipo_unidad_id, unidad);
      }
    }
  }

  // Recopilamos templates por tipo. Key dedup:
  // - Madera: `${tipoId}|fase|espacio|nombre` (las 2 subfases colapsan)
  // - Otras:  `${tipoId}|fase|espacio|nombre|subfase`
  type TareaCargada = TareaInput & { _tipoIdSource: string };
  const porTipo = new Map<string, TareaCargada[]>();

  for (const [dbTipoId, unidad] of representativePorTipo) {
    const localId = tipoIdToLocalId.get(dbTipoId);
    if (!localId) continue;
    const seenLocal = new Set<string>();
    const lista: TareaCargada[] = [];
    for (const espacio of unidad.espacios) {
      for (const tarea of espacio.tareas) {
        const isMadera = tarea.fase.nombre === "Madera";
        const key = isMadera
          ? `${tarea.fase.nombre}|${espacio.nombre}|${tarea.nombre}`
          : `${tarea.fase.nombre}|${espacio.nombre}|${tarea.nombre}|${tarea.subfase ?? ""}`;
        if (seenLocal.has(key)) continue;
        seenLocal.add(key);

        lista.push({
          id: `db-${tarea.id}`,
          fase: tarea.fase.nombre,
          espacio: espacio.nombre,
          nombre: tarea.nombre,
          tiempo_acordado_dias: tarea.tiempo_acordado_dias,
          ...(isMadera ? { tipo_unidad_id: localId } : {}),
          ...(!isMadera && tarea.subfase ? { subfase: tarea.subfase } : {}),
          ...(tarea.codigo_referencia ? { codigo_referencia: tarea.codigo_referencia } : {}),
          ...(tarea.marca_linea ? { marca_linea: tarea.marca_linea } : {}),
          ...(tarea.componentes ? { componentes: tarea.componentes } : {}),
          ...(tarea.precio != null ? { precio: tarea.precio } : {}),
          // Component flags para Madera (defaults true para estructura/nave si Madera)
          tiene_estructura: tarea.tiene_estructura,
          tiene_nave: tarea.tiene_nave,
          tiene_chapa: tarea.tiene_chapa,
          tiene_cartera: tarea.tiene_cartera,
          _tipoIdSource: localId,
        });
      }
    }
    porTipo.set(localId, lista);
  }

  // Dedup cross-tipo para tareas no-Madera: si un mismo (fase, espacio, nombre,
  // subfase) aparece en TODOS los tipos, lo conservamos sin tipo_unidad_id.
  // Si aparece solo en algunos, mantenemos copia por tipo con su tag.
  const allLocalTipoIds = [...porTipo.keys()];
  const occurrences = new Map<string, Set<string>>();
  for (const [localId, lista] of porTipo) {
    for (const t of lista) {
      if (t.fase === "Madera") continue; // Madera siempre va por tipo
      const k = `${t.fase}|${t.espacio}|${t.nombre}|${t.subfase ?? ""}`;
      const set = occurrences.get(k) ?? new Set<string>();
      set.add(localId);
      occurrences.set(k, set);
    }
  }

  const inserted = new Set<string>();
  for (const [localId, lista] of porTipo) {
    for (const t of lista) {
      if (t.fase === "Madera") {
        // Madera: incluir tal cual (con su tipo_unidad_id)
        tareas.push({
          id: t.id,
          fase: t.fase,
          espacio: t.espacio,
          nombre: t.nombre,
          tiempo_acordado_dias: t.tiempo_acordado_dias,
          ...(t.tipo_unidad_id ? { tipo_unidad_id: t.tipo_unidad_id } : {}),
          ...(t.codigo_referencia ? { codigo_referencia: t.codigo_referencia } : {}),
          ...(t.marca_linea ? { marca_linea: t.marca_linea } : {}),
          ...(t.componentes ? { componentes: t.componentes } : {}),
          ...(t.precio != null ? { precio: t.precio } : {}),
          tiene_estructura: t.tiene_estructura,
          tiene_nave: t.tiene_nave,
          tiene_chapa: t.tiene_chapa,
          tiene_cartera: t.tiene_cartera,
        });
        continue;
      }
      const k = `${t.fase}|${t.espacio}|${t.nombre}|${t.subfase ?? ""}`;
      const presentes = occurrences.get(k);
      if (presentes && presentes.size === allLocalTipoIds.length) {
        // Aparece en todos los tipos: incluir UNA vez sin tipo_unidad_id
        if (!inserted.has(k)) {
          inserted.add(k);
          tareas.push({
            id: t.id,
            fase: t.fase,
            espacio: t.espacio,
            nombre: t.nombre,
            tiempo_acordado_dias: t.tiempo_acordado_dias,
            ...(t.subfase ? { subfase: t.subfase } : {}),
            ...(t.codigo_referencia ? { codigo_referencia: t.codigo_referencia } : {}),
            ...(t.marca_linea ? { marca_linea: t.marca_linea } : {}),
            ...(t.componentes ? { componentes: t.componentes } : {}),
            ...(t.precio != null ? { precio: t.precio } : {}),
          });
        }
      } else {
        // Solo en algunos tipos: incluir por tipo con etiqueta
        tareas.push({
          id: `${t.id}|${localId}`,
          fase: t.fase,
          espacio: t.espacio,
          nombre: t.nombre,
          tiempo_acordado_dias: t.tiempo_acordado_dias,
          tipo_unidad_id: localId,
          ...(t.subfase ? { subfase: t.subfase } : {}),
          ...(t.codigo_referencia ? { codigo_referencia: t.codigo_referencia } : {}),
          ...(t.marca_linea ? { marca_linea: t.marca_linea } : {}),
          ...(t.componentes ? { componentes: t.componentes } : {}),
          ...(t.precio != null ? { precio: t.precio } : {}),
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

  // ── Asignaciones existentes (reverse-engineered) ─────────────────────────
  // Recorre todas las tareas con asignado_a y produce overrides en el scope
  // más amplio donde la asignación es consistente: global > torre > torre+apto.
  type Inst = { torre: string; unidad: string; asignado_a: string | null };
  const byTemplate = new Map<string, Inst[]>(); // key: fase|tareaKey
  for (const edificio of proyecto.edificios) {
    if (edificio.es_zona_comun) continue;
    for (const piso of edificio.pisos) {
      for (const unidad of piso.unidades) {
        for (const espacio of unidad.espacios) {
          for (const tarea of espacio.tareas) {
            const tareaKey = tarea.subfase
              ? `${tarea.nombre}::${tarea.subfase}`
              : tarea.nombre;
            const key = `${tarea.fase.nombre}|${tareaKey}`;
            if (!byTemplate.has(key)) byTemplate.set(key, []);
            byTemplate.get(key)!.push({
              torre: edificio.nombre,
              unidad: unidad.nombre,
              asignado_a: tarea.asignado_a ?? null,
            });
          }
        }
      }
    }
  }

  const asignaciones: AsignacionOverride[] = [];
  for (const [templateKey, instances] of byTemplate) {
    const sepIdx = templateKey.indexOf("|");
    const fase = templateKey.slice(0, sepIdx);
    const tareaKey = templateKey.slice(sepIdx + 1);

    // Global: TODAS las instancias asignadas al mismo contratista.
    if (instances.every((i) => i.asignado_a !== null)) {
      const unique = new Set(instances.map((i) => i.asignado_a));
      if (unique.size === 1) {
        const cid = instances[0].asignado_a!;
        asignaciones.push({ fase, tarea_nombre: tareaKey, contratista_id: cid });
        continue;
      }
    }

    // Por torre: dentro de cada torre, todas iguales no-null.
    const byTorre = new Map<string, Inst[]>();
    for (const i of instances) {
      if (!byTorre.has(i.torre)) byTorre.set(i.torre, []);
      byTorre.get(i.torre)!.push(i);
    }
    for (const [torre, torreInsts] of byTorre) {
      if (torreInsts.every((i) => i.asignado_a !== null)) {
        const unique = new Set(torreInsts.map((i) => i.asignado_a));
        if (unique.size === 1) {
          const cid = torreInsts[0].asignado_a!;
          asignaciones.push({ fase, torre, tarea_nombre: tareaKey, contratista_id: cid });
          continue;
        }
      }
      // Por unidad: emitir override individual donde haya asignado_a.
      for (const i of torreInsts) {
        if (i.asignado_a === null) continue;
        asignaciones.push({
          fase,
          torre,
          unidad_nombre: i.unidad,
          tarea_nombre: tareaKey,
          contratista_id: i.asignado_a,
        });
      }
    }
  }

  // ── Return EditModeData ──────────────────────────────────────────────────
  return {
    projectId: proyecto.id,
    nombre: proyecto.nombre,
    numeroRegistro: proyecto.numero_registro ?? "",
    contratistaDefaultId: proyecto.contratista_default_id ?? "",
    clienteId: proyecto.cliente_id ?? "",
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
    asignaciones,
  };
}
