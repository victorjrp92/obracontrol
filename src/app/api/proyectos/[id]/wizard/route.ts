import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGeneralAdmin } from "@/lib/access";
import { aprenderTareas } from "@/lib/learning";

/**
 * Wizard payload — same shape as the creation wizard POST endpoint.
 * For edit mode, tareas come from the payload (not TASK_TEMPLATES).
 */
interface WizardPayload {
  password: string;
  // Paso 1
  nombre: string;
  numero_registro?: string;
  contratista_default_id?: string;
  cliente_id?: string;
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
    distribucion?: Record<string, number | { derecha: number; izquierda: number }>;
  }[];
  // Paso 3 — espacios y tareas
  espacios: string[];
  fases: (string | { nombre: string; tiempo_estimado_dias?: number })[];
  tareas: {
    fase: string;
    subfase?: string;
    espacio: string;
    nombre: string;
    tiempo_acordado_dias: number;
    precio?: number;
    codigo_referencia?: string;
    marca_linea?: string;
    componentes?: string;
    asignado_a?: string;
    // Nombre del TipoUnidad al que aplica (Madera con tipos específicos).
    // El cliente envía el nombre, no el id local.
    tipo_unidad_id?: string;
    tiene_estructura?: boolean;
    tiene_nave?: boolean;
    tiene_chapa?: boolean;
    tiene_cartera?: boolean;
    lustro_dias?: number;
    lustro_precio?: number;
    lustro_excluido?: boolean;
  }[];
  zonas_comunes?: string[];
  zonas_comunes_metrajes?: Record<string, number>;
  asignaciones?: {
    fase: string;
    subfase?: string | null;
    torre?: string | null;
    unidad_nombre?: string | null;
    espacio?: string | null;
    tarea_nombre?: string | null;
    contratista_id: string;
  }[];
}

function resolveContratista(
  overrides: WizardPayload["asignaciones"],
  tarea: { fase: string; nombre: string; subfase?: string | null },
  torre: string,
  unidad: string,
  espacio: string,
  fallback: string | null,
): string | null {
  if (!overrides?.length) return fallback;
  let best: { score: number; id: string } | null = null;
  for (const o of overrides) {
    if (o.fase !== tarea.fase) continue;
    let score = 1;
    if (o.subfase != null) { if (o.subfase !== (tarea.subfase ?? null)) continue; score += 2; }
    if (o.torre != null) { if (o.torre !== torre) continue; score += 4; }
    if (o.unidad_nombre != null) { if (o.unidad_nombre !== unidad) continue; score += 8; }
    if (o.espacio != null) { if (o.espacio !== espacio) continue; score += 16; }
    if (o.tarea_nombre != null) {
      const tareaKey = tarea.subfase ? `${tarea.nombre}::${tarea.subfase}` : tarea.nombre;
      if (o.tarea_nombre !== tareaKey) continue;
      score += 32;
    }
    if (!best || score > best.score) best = { score, id: o.contratista_id };
  }
  return best?.id ?? fallback;
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

    // Tenant isolation: verify contratista_ids in asignaciones overlay
    const asignacionIds = Array.from(
      new Set(
        (body.asignaciones ?? [])
          .map((a) => a.contratista_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
    );
    if (asignacionIds.length > 0) {
      const validosAsig = await prisma.usuario.findMany({
        where: { id: { in: asignacionIds }, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (validosAsig.length !== asignacionIds.length) {
        return NextResponse.json(
          { error: "Uno o más contratistas en asignaciones no pertenecen a esta constructora" },
          { status: 400 },
        );
      }
    }

    // Tenant isolation: verify cliente_id belongs to this constructora
    if (body.cliente_id) {
      const clienteValido = await prisma.cliente.findFirst({
        where: { id: body.cliente_id, constructora_id: currentUser.constructora_id },
        select: { id: true },
      });
      if (!clienteValido) {
        return NextResponse.json(
          { error: "El cliente no pertenece a esta constructora" },
          { status: 400 },
        );
      }
    }

    // Bound asignaciones array size
    const MAX_ASIGNACIONES = 5000;
    if (body.asignaciones && body.asignaciones.length > MAX_ASIGNACIONES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_ASIGNACIONES} asignaciones por proyecto` },
        { status: 400 },
      );
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
          const distTotal = Object.values(ed.distribucion).reduce<number>(
            (a, b) => {
              if (typeof b === "number") return a + b;
              return a + (b.derecha ?? 0) + (b.izquierda ?? 0);
            },
            0,
          );
          const maxTotal = ed.pisos * MAX_UNIDADES_POR_PISO;
          if (distTotal > maxTotal) {
            return NextResponse.json(
              { error: `La distribución total (${distTotal}) supera el máximo de ${maxTotal} unidades para ${ed.pisos} pisos` },
              { status: 400 },
            );
          }
          if (ed.unidadesPorPiso !== undefined && distTotal !== ed.pisos * ed.unidadesPorPiso) {
            return NextResponse.json(
              {
                error: `Distribución descuadrada en "${ed.nombre}": suma ${distTotal} pero la torre tiene capacidad ${ed.pisos * ed.unidadesPorPiso} (${ed.pisos} pisos × ${ed.unidadesPorPiso} uds/piso). Ajusta los totales para que coincidan.`,
              },
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

    // Tipo común para las filas de tarea que insertamos en bulk.
    type TareaRowToInsert = {
      espacio_id: string;
      fase_id: string;
      nombre: string;
      subfase: string | null;
      tiempo_acordado_dias: number;
      codigo_referencia: string | null;
      marca_linea: string | null;
      componentes: string | null;
      precio: number | null;
      asignado_a: string | null;
      tiene_estructura: boolean;
      tiene_nave: boolean;
      tiene_chapa: boolean;
      tiene_cartera: boolean;
      estado: "PENDIENTE";
    };

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
        tareas_reasignadas: 0,
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
          ...(body.numero_registro ? { numero_registro: body.numero_registro } : {}),
          ...(body.contratista_default_id !== undefined ? { contratista_default_id: body.contratista_default_id || null } : {}),
          cliente_id: body.cliente_id || null,
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

      // Helper que filtra tareas-template aplicables a un (espacio, tipoUnidad)
      // y expande las subfases de Madera (Instalación + Detallado y lustro),
      // alineado con el wizard de creación. Definido aquí dentro de la
      // transacción porque depende de `fasesMap`.
      function expandTareasParaEspacio(
        espacioId: string,
        nombreEspacio: string,
        tipoNombre: string,
        defaultAsignadoId: string | null,
        torreNombre?: string,
        unidadNombre?: string,
      ): TareaRowToInsert[] {
        const out: TareaRowToInsert[] = [];
        for (const t of tareasInput) {
          if (t.espacio !== nombreEspacio) continue;
          if (t.tipo_unidad_id && t.tipo_unidad_id !== tipoNombre) continue;
          const faseId = fasesMap[t.fase];
          if (!faseId) continue;
          const isMadera = t.fase === "Madera";
          const fallback = t.asignado_a ?? defaultAsignadoId;
          const baseRow = {
            espacio_id: espacioId,
            fase_id: faseId,
            nombre: t.nombre,
            codigo_referencia: t.codigo_referencia ?? null,
            marca_linea: t.marca_linea ?? null,
            componentes: t.componentes ?? null,
            tiene_estructura: t.tiene_estructura ?? (isMadera ? true : false),
            tiene_nave: t.tiene_nave ?? (isMadera ? true : false),
            tiene_chapa: t.tiene_chapa ?? false,
            tiene_cartera: t.tiene_cartera ?? false,
            estado: "PENDIENTE" as const,
          };

          if (isMadera) {
            const diasInstalacion = calcDias(t.tiempo_acordado_dias, t.fase);
            out.push({
              ...baseRow,
              subfase: "Instalación",
              tiempo_acordado_dias: diasInstalacion,
              precio: t.precio ?? null,
              asignado_a: torreNombre && unidadNombre
                ? resolveContratista(body.asignaciones, { fase: t.fase, nombre: t.nombre, subfase: "Instalación" }, torreNombre, unidadNombre, nombreEspacio, fallback)
                : fallback,
            });
            if (!t.lustro_excluido) {
              const diasLustro = calcDias(t.lustro_dias ?? t.tiempo_acordado_dias, t.fase);
              out.push({
                ...baseRow,
                subfase: "Detallado y lustro",
                tiempo_acordado_dias: diasLustro,
                precio: t.lustro_precio ?? null,
                asignado_a: torreNombre && unidadNombre
                  ? resolveContratista(body.asignaciones, { fase: t.fase, nombre: t.nombre, subfase: "Detallado y lustro" }, torreNombre, unidadNombre, nombreEspacio, fallback)
                  : fallback,
              });
            }
          } else {
            const dias = calcDias(t.tiempo_acordado_dias, t.fase);
            const subfase = t.subfase ?? null;
            out.push({
              ...baseRow,
              subfase,
              tiempo_acordado_dias: dias,
              precio: t.precio ?? null,
              asignado_a: torreNombre && unidadNombre
                ? resolveContratista(body.asignaciones, { fase: t.fase, nombre: t.nombre, subfase }, torreNombre, unidadNombre, nombreEspacio, fallback)
                : fallback,
            });
          }
        }
        return out;
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

        type DistEntry = [string, number, string | null];
        let distribution: DistEntry[];
        if (edificioInput.distribucion) {
          distribution = [];
          for (const [tipoNombre, val] of Object.entries(edificioInput.distribucion)) {
            if (typeof val === "number") {
              distribution.push([tipoNombre, val, null]);
            } else {
              if (val.derecha > 0) distribution.push([tipoNombre, val.derecha, "derecha"]);
              if (val.izquierda > 0) distribution.push([tipoNombre, val.izquierda, "izquierda"]);
            }
          }
        } else {
          const firstTipo = Object.keys(tipoMap)[0];
          distribution = [[firstTipo, edificioInput.unidadesPorPiso ?? 4, null]];
        }

        // Aplanamos la distribución de torre (totales) en una lista,
        // luego la repartimos en los slots pisos × unidades_por_piso.
        type UnitSpec = { tipoNombre: string; sentido: string | null };
        const allTowerUnits: UnitSpec[] = [];
        for (const [tipoNombre, count, sentido] of distribution) {
          for (let i = 0; i < count; i++) {
            allTowerUnits.push({ tipoNombre, sentido });
          }
        }
        const udsPerFloor = edificioInput.unidadesPorPiso ?? (
          edificioInput.pisos > 0
            ? Math.ceil(allTowerUnits.length / edificioInput.pisos)
            : 0
        );

        let totalUnitsCreated = 0;
        let totalTareasCreated = 0;
        const tareasPendientes: TareaRowToInsert[] = [];

        let unitIdx = 0;
        for (let p = 1; p <= edificioInput.pisos; p++) {
          const piso = await txInner.piso.create({
            data: { edificio_id: edificio.id, numero: p },
          });

          for (let slot = 0; slot < udsPerFloor; slot++) {
            const spec = allTowerUnits[unitIdx];
            if (!spec) break;
            const tipoInfo = tipoMap[spec.tipoNombre];
            if (!tipoInfo) { unitIdx++; continue; }

            const unitName = `${p}0${slot + 1}`;
            const unidad = await txInner.unidad.create({
              data: {
                piso_id: piso.id,
                nombre: unitName,
                tipo_unidad_id: tipoInfo.id,
                sentido: spec.sentido,
                ...(tipoInfo.metraje_total != null
                  ? { metraje_total: tipoInfo.metraje_total }
                  : {}),
              },
            });
            unitIdx++;
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

              const filas = expandTareasParaEspacio(
                espacio.id,
                nombreEspacio,
                spec.tipoNombre,
                null,
                edificioInput.nombre,
                unitName,
              );
              for (const fila of filas) {
                tareasPendientes.push(fila);
                totalTareasCreated++;
              }
            }
          }
        }

        // Bulk-insert todas las tareas de la torre en una sola query
        // (evita timeout P2028 cuando son cientos de tareas).
        if (tareasPendientes.length > 0) {
          await txInner.tarea.createMany({ data: tareasPendientes });
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
          type DistEntryEdit = [string, number, string | null];
          let incomingDist: DistEntryEdit[];
          if (edificioInput.distribucion) {
            incomingDist = [];
            for (const [tipoNombre, val] of Object.entries(edificioInput.distribucion)) {
              if (typeof val === "number") {
                incomingDist.push([tipoNombre, val, null]);
              } else {
                if (val.derecha > 0) incomingDist.push([tipoNombre, val.derecha, "derecha"]);
                if (val.izquierda > 0) incomingDist.push([tipoNombre, val.izquierda, "izquierda"]);
              }
            }
          } else {
            const firstTipo = Object.keys(tipoMap)[0];
            incomingDist = [[firstTipo, edificioInput.unidadesPorPiso ?? 4, null]];
          }

          // Build existing distribution from actual data (keyed by "tipo:sentido")
          // Sumamos TODOS los pisos: distribución es total de torre, no por-piso.
          let distributionChanged = false;
          if (!pisosChanged && existing.pisos.length > 0) {
            const existingDistMap: Record<string, number> = {};
            for (const piso of existing.pisos) {
              for (const unidad of piso.unidades) {
                const tipoName = unidad.tipo_unidad?.nombre ?? "Tipo estandar";
                const s = (unidad as { sentido?: string | null }).sentido ?? null;
                const key = s ? `${tipoName}:${s}` : tipoName;
                existingDistMap[key] = (existingDistMap[key] ?? 0) + 1;
              }
            }

            const incomingDistMap: Record<string, number> = {};
            for (const [name, count, sentido] of incomingDist) {
              const key = sentido ? `${name}:${sentido}` : name;
              incomingDistMap[key] = count;
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

            // Recreate structure: distribución = TOTALES DE TORRE.
            // Aplanamos la lista de unidades y las repartimos en los slots
            // pisos × unidades_por_piso (alineado con el wizard de creación).
            type UnitSpec = { tipoNombre: string; sentido: string | null };
            const allTowerUnits: UnitSpec[] = [];
            for (const [tipoNombre, count, sentido] of incomingDist) {
              for (let i = 0; i < count; i++) {
                allTowerUnits.push({ tipoNombre, sentido });
              }
            }
            const udsPerFloor = edificioInput.unidadesPorPiso ?? (
              edificioInput.pisos > 0
                ? Math.ceil(allTowerUnits.length / edificioInput.pisos)
                : 0
            );

            let totalTareasCreated = 0;
            const tareasPendientesRecreate: TareaRowToInsert[] = [];

            let unitIdx = 0;
            for (let p = 1; p <= edificioInput.pisos; p++) {
              const piso = await tx.piso.create({
                data: { edificio_id: existing.id, numero: p },
              });

              for (let slot = 0; slot < udsPerFloor; slot++) {
                const spec = allTowerUnits[unitIdx];
                if (!spec) break;
                const tipoInfo = tipoMap[spec.tipoNombre];
                if (!tipoInfo) { unitIdx++; continue; }

                const unitName2 = `${p}0${slot + 1}`;
                const unidad = await tx.unidad.create({
                  data: {
                    piso_id: piso.id,
                    nombre: unitName2,
                    tipo_unidad_id: tipoInfo.id,
                    sentido: spec.sentido,
                    ...(tipoInfo.metraje_total != null
                      ? { metraje_total: tipoInfo.metraje_total }
                      : {}),
                  },
                });
                unitIdx++;

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

                  const filas = expandTareasParaEspacio(
                    espacio.id,
                    nombreEspacio,
                    spec.tipoNombre,
                    null,
                    edificioInput.nombre,
                    unitName2,
                  );
                  for (const fila of filas) {
                    tareasPendientesRecreate.push(fila);
                    totalTareasCreated++;
                  }
                }
              }
            }

            if (tareasPendientesRecreate.length > 0) {
              await tx.tarea.createMany({ data: tareasPendientesRecreate });
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
      // Por cada edificio conservado, calculamos las tareas "esperadas" para cada
      // unidad (aplicando expandTareasParaEspacio según el tipo de la unidad) y
      // las comparamos con las "actuales" en BD. Esta versión respeta las
      // subfases de Madera y el filtro por tipo_unidad_id.
      const edificioIdToName = new Map(
        existingEdificios.map((e) => [e.id, e.nombre]),
      );
      for (const edificioId of keptEdificioIds) {
        const torreNombreKept = edificioIdToName.get(edificioId) ?? "";
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
                        subfase: true,
                        fase: { select: { nombre: true } },
                        tiempo_acordado_dias: true,
                        estado: true,
                        asignado_a: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (pisosForEdificio.length === 0) continue;

        const tareasACrear: TareaRowToInsert[] = [];
        const tareaIdsAEliminar: string[] = [];
        const updatesPorDias = new Map<number, string[]>();
        const updatesPorAsignado = new Map<string, { ids: string[]; anteriores: Map<string, string | null> }>();

        const keyFromRow = (faseNombre: string, nombre: string, subfase: string | null) =>
          `${faseNombre}|${nombre}|${subfase ?? ""}`;

        for (const piso of pisosForEdificio) {
          for (const unidad of piso.unidades) {
            const tipoNombre = unidad.tipo_unidad?.nombre ?? "Tipo estándar";
            for (const espacio of unidad.espacios) {
              const esperadas = expandTareasParaEspacio(
                espacio.id,
                espacio.nombre,
                tipoNombre,
                null,
                torreNombreKept,
                unidad.nombre,
              );

              // Lookup esperadas por key. Mapeamos fase_id → fase_nombre vía fasesNormalized:
              const esperadasPorKey = new Map<string, TareaRowToInsert>();
              for (const e of esperadas) {
                // recuperar fase nombre desde fase_id
                const faseNombre = fasesNormalized.find(
                  (f) => fasesMap[f.nombre] === e.fase_id,
                )?.nombre;
                if (!faseNombre) continue;
                esperadasPorKey.set(keyFromRow(faseNombre, e.nombre, e.subfase), e);
              }

              const actualesPorKey = new Map<string, typeof espacio.tareas[number]>();
              for (const t of espacio.tareas) {
                actualesPorKey.set(
                  keyFromRow(t.fase.nombre, t.nombre, t.subfase),
                  t,
                );
              }

              // Crear: esperadas que no existen
              for (const [k, e] of esperadasPorKey) {
                if (!actualesPorKey.has(k)) {
                  tareasACrear.push(e);
                  stats.tareas_creadas++;
                }
              }

              // Eliminar: actuales PENDIENTE que no están en esperadas
              for (const [k, a] of actualesPorKey) {
                if (!esperadasPorKey.has(k) && a.estado === "PENDIENTE") {
                  tareaIdsAEliminar.push(a.id);
                  stats.tareas_eliminadas++;
                }
              }

              // Actualizar días: si coincide pero los días difieren (solo PENDIENTE)
              for (const [k, e] of esperadasPorKey) {
                const a = actualesPorKey.get(k);
                if (!a || a.estado !== "PENDIENTE") continue;
                if (a.tiempo_acordado_dias === e.tiempo_acordado_dias) continue;
                const bucket = updatesPorDias.get(e.tiempo_acordado_dias) ?? [];
                bucket.push(a.id);
                updatesPorDias.set(e.tiempo_acordado_dias, bucket);
                stats.tareas_actualizadas++;
              }

              // Reasignar contratista: si coincide la key pero asignado_a difiere
              // (PENDIENTE o NO_APROBADA). APROBADA/REPORTADA se preservan.
              for (const [k, e] of esperadasPorKey) {
                const a = actualesPorKey.get(k);
                if (!a) continue;
                if (a.estado !== "PENDIENTE" && a.estado !== "NO_APROBADA") continue;
                if ((a.asignado_a ?? null) === (e.asignado_a ?? null)) continue;
                const nuevo = e.asignado_a ?? "__NULL__";
                const bucket = updatesPorAsignado.get(nuevo) ?? { ids: [] as string[], anteriores: new Map<string, string | null>() };
                bucket.ids.push(a.id);
                bucket.anteriores.set(a.id, a.asignado_a ?? null);
                updatesPorAsignado.set(nuevo, bucket);
                stats.tareas_reasignadas++;
              }
            }
          }
        }

        // Aplicar los tres batches en bulk
        if (tareasACrear.length > 0) {
          await tx.tarea.createMany({ data: tareasACrear });
        }
        if (tareaIdsAEliminar.length > 0) {
          await tx.tarea.deleteMany({ where: { id: { in: tareaIdsAEliminar } } });
        }
        for (const [dias, ids] of updatesPorDias) {
          await tx.tarea.updateMany({
            where: { id: { in: ids } },
            data: { tiempo_acordado_dias: dias },
          });
        }
        for (const [nuevoKey, bucket] of updatesPorAsignado) {
          const nuevoId = nuevoKey === "__NULL__" ? null : nuevoKey;
          await tx.tarea.updateMany({
            where: { id: { in: bucket.ids } },
            data: { asignado_a: nuevoId },
          });
          await tx.reasignacionTarea.createMany({
            data: bucket.ids.map((tid) => ({
              tarea_id: tid,
              proyecto_id: id,
              contratista_anterior_id: bucket.anteriores.get(tid) ?? null,
              contratista_nuevo_id: nuevoId,
              realizado_por: currentUser.id,
              motivo: "Edición de proyecto (wizard)",
            })),
          });
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
    }, { timeout: 180000, maxWait: 10000 });

    // Learn tasks for this constructora (fire-and-forget)
    if (body.tareas && body.tareas.length > 0) {
      aprenderTareas(currentUser.constructora_id, body.tareas).catch((e) =>
        console.error("Learning failed (non-blocking):", e),
      );
    }

    return NextResponse.json({ updated: true, summary });
  } catch (err) {
    console.error("POST /api/proyectos/[id]/wizard", err);
    return NextResponse.json({ error: "Error actualizando proyecto" }, { status: 500 });
  }
}
