import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TASK_TEMPLATES } from "@/lib/task-templates";
import { isGeneralAdmin } from "@/lib/access";
import { validarNumeroProyecto, generarNumeroTarea } from "@/lib/numero-registro";
import { aprenderTareas } from "@/lib/learning";
import {
  clavePrediccion,
  construirPreRegistro,
  flushPreRegistrosDuracion,
  predecirDuracionesMotor,
  type PrediccionTarea,
  type PreRegistroDuracion,
} from "@/lib/duraciones-mercado";
import type { EspacioEstim } from "@/lib/estimar-presupuesto";

interface WizardPayload {
  // Paso 1
  nombre: string;
  numero_registro?: string;
  contratista_default_id?: string;
  cliente_id?: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  dias_habiles_semana: number;
  fecha_inicio?: string;
  fecha_fin_estimada?: string;
  ubicacion_lat?: number | null;
  ubicacion_lng?: number | null;
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
    distribucion?: Record<string, number | { derecha: number; izquierda: number }>;
    unidades_detalle?: Record<string, { nombre: string; tipo_unidad: string; sentido: string; nombre_personalizado?: string }[]>;
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
  personas?: { nombre: string; cargo: string; email: string }[];
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

// ── Duration engine prediction (Fase 0: measure the ALGORITHM, not the user) ──
// `tiempo_acordado_dias` is the USER'S PLAN (the wizard splits the deadline
// across tasks). To be able to compute the engine's error we store what
// `estimarDuracion` predicted at creation time into `RegistroDuracion.dias_motor`
// as a PRE-REGISTERED row, which the task's approval later completes with the
// real days. Never blocks project creation: it is telemetry.

/** Default m² per espacio. Mirrored by `createEspaciosYTareas` below. */
const METRAJE_ESPACIO_DEFECTO = 15;

/**
 * Cap on accumulated pre-registro rows. A tower (200 floors × 200 units) can
 * generate tens of thousands of tasks; the flywheel does not need every row and
 * an unbounded array would blow up memory before the batch insert.
 */
const MAX_PREREGISTROS_DURACION = 5000;

/** Synthetic key of an espacio inside the payload (group + index). */
function claveEspacioWizard(grupo: string, indice: number): string {
  return `${grupo}#${indice}`;
}

type TipoUnidadPayload = NonNullable<WizardPayload["tipos_unidad"]>[number];

/**
 * Runs the deterministic engine over the payload and returns its prediction per
 * espacio+tarea. One pass per unidad type: every unit of the same type shares
 * espacios and metrajes, so the per-task prediction is identical.
 * NEVER throws — if the engine fails the project is created anyway and only the
 * telemetry is lost (`dias_motor` stays null).
 */
function predecirDuracionesWizard(body: WizardPayload): Map<string, PrediccionTarea> {
  const predicciones = new Map<string, PrediccionTarea>();
  try {
    // Mirrors the tipoMap fallback inside the transaction (legacy payloads send
    // a flat `espacios` list and no `tipos_unidad`).
    const tipos: TipoUnidadPayload[] =
      body.tipos_unidad && body.tipos_unidad.length > 0
        ? body.tipos_unidad
        : [{ nombre: "Tipo estándar", espacios: body.espacios ?? [] }];

    for (const tipo of tipos) {
      const espacios: EspacioEstim[] = (tipo.espacios ?? []).map((nombreEspacio, i) => ({
        id: claveEspacioWizard(tipo.nombre, i),
        nombre: nombreEspacio,
        metraje: tipo.metrajes_espacios?.[nombreEspacio] ?? METRAJE_ESPACIO_DEFECTO,
        tareas: (body.tareas ?? [])
          .filter(
            (t) =>
              t.espacio === nombreEspacio &&
              (!t.tipo_unidad_id || t.tipo_unidad_id === tipo.nombre),
          )
          .map((t) => ({
            nombre: t.nombre,
            dias: Math.max(1, Math.round(t.tiempo_acordado_dias || 1)),
            on: true,
            fase: t.fase,
          })),
      }));
      for (const [k, v] of predecirDuracionesMotor(espacios)) predicciones.set(k, v);
    }

    // Zonas comunes: one espacio per zona, tasks from the shared template.
    const zonas = body.zonas_comunes ?? [];
    if (zonas.length > 0) {
      const espaciosZC: EspacioEstim[] = zonas.map((nombreZona, i) => {
        const metraje = body.zonas_comunes_metrajes?.[nombreZona];
        return {
          id: claveEspacioWizard("zc", i),
          nombre: nombreZona,
          ...(metraje != null ? { metraje } : {}),
          tareas: (TASK_TEMPLATES["Zonas Comunes"]?.[nombreZona] ?? []).map((t) => ({
            nombre: t.nombre,
            dias: Math.max(1, Math.round(t.tiempo_acordado_dias || 1)),
            on: true,
          })),
        };
      });
      for (const [k, v] of predecirDuracionesMotor(espaciosZC)) predicciones.set(k, v);
    }
  } catch (err) {
    // Not critical: the duration flywheel is telemetry, not part of the flow.
    console.warn("predecirDuracionesWizard failed (non-critical):", err);
  }
  return predicciones;
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

    // Número de registro del proyecto (obligatorio, único por constructora)
    const numeroVal = validarNumeroProyecto(body.numero_registro);
    if (!numeroVal.ok) {
      return NextResponse.json({ error: numeroVal.error }, { status: 400 });
    }
    const numeroRegistro = numeroVal.normalizado!;
    const numeroDuplicado = await prisma.proyecto.findFirst({
      where: { constructora_id: currentUser.constructora_id, numero_registro: numeroRegistro },
      select: { id: true, nombre: true },
    });
    if (numeroDuplicado) {
      return NextResponse.json(
        { error: `El número de registro "${numeroRegistro}" ya está en uso por el proyecto "${numeroDuplicado.nombre}"` },
        { status: 409 },
      );
    }

    // Contratista por defecto del proyecto (opcional)
    let contratistaDefault: { id: string } | null = null;
    if (body.contratista_default_id) {
      contratistaDefault = await prisma.usuario.findFirst({
        where: {
          id: body.contratista_default_id,
          constructora_id: currentUser.constructora_id,
          rol_ref: { nivel_acceso: "CONTRATISTA" },
        },
        select: { id: true },
      });
      if (!contratistaDefault) {
        return NextResponse.json(
          { error: "El contratista por defecto no es válido o no pertenece a esta constructora" },
          { status: 400 },
        );
      }
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
      if (t.subfase && typeof t.subfase === "string" && t.subfase.length > 80) {
        return NextResponse.json(
          { error: `Subfase max 80 caracteres` },
          { status: 400 },
        );
      }
      if (t.precio !== undefined && typeof t.precio === "number" && t.precio < 0) {
        return NextResponse.json(
          { error: `La tarea "${t.nombre}" tiene precio negativo` },
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

    // Bound structural counts to prevent DoS via huge row creation.
    const MAX_ASIGNACIONES = 5000;
    if (body.asignaciones && body.asignaciones.length > MAX_ASIGNACIONES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_ASIGNACIONES} asignaciones por proyecto` },
        { status: 400 },
      );
    }
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
          // Distribución debe cuadrar con la capacidad de la torre.
          // Si no cuadra, el servidor crearía menos o más unidades de las indicadas
          // y los totales del wizard quedarían inconsistentes con la BD.
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

    // Engine prediction per espacio+tarea (pure, outside the transaction) plus
    // the accumulator of pre-registro rows (persisted AFTER the transaction).
    const prediccionesDuracion = predecirDuracionesWizard(body);
    const preRegistrosDuracion: PreRegistroDuracion[] = [];
    const acumularPreRegistro = (
      clave: string,
      args: { nombre: string; fase: string; dias: number; metraje: number | null },
    ) => {
      if (preRegistrosDuracion.length >= MAX_PREREGISTROS_DURACION) return;
      const pre = construirPreRegistro({
        nombreTarea: args.nombre,
        faseProyecto: args.fase,
        diasAcordados: args.dias,
        metraje: args.metraje,
        // El wizard B2B no captura ciudad del proyecto (queda null en Proyecto).
        ciudad: null,
        cuadrillas: 1, // los dos call sites del motor fijan 1 hoy
        prediccion: prediccionesDuracion.get(clavePrediccion(clave, args.nombre)),
      });
      if (pre) preRegistrosDuracion.push(pre);
    };

    // Crear todo en una transacción
    const proyectoCreado = await prisma.$transaction(async (tx) => {
      // 1. Proyecto
      const proyecto = await tx.proyecto.create({
        data: {
          constructora_id: currentUser.constructora_id,
          numero_registro: numeroRegistro,
          contratista_default_id: contratistaDefault?.id ?? null,
          cliente_id: body.cliente_id || null,
          nombre: body.nombre,
          subtipo: body.subtipo,
          dias_habiles_semana: body.dias_habiles_semana ?? 6,
          fecha_inicio: body.fecha_inicio ? new Date(body.fecha_inicio) : null,
          fecha_fin_estimada: body.fecha_fin_estimada ? new Date(body.fecha_fin_estimada) : null,
          ubicacion_lat: typeof body.ubicacion_lat === "number" ? body.ubicacion_lat : null,
          ubicacion_lng: typeof body.ubicacion_lng === "number" ? body.ubicacion_lng : null,
          estado: "ACTIVO",
        },
      });

      // Contador global de tareas para numeración secuencial dentro del proyecto.
      let tareaSeq = 0;

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

        // Build flat list of all units for the tower (distribution = torre totals)
        type UnitSpec = { tipoNombre: string; sentido: string | null };
        const allTowerUnits: UnitSpec[] = [];
        if (edificioInput.distribucion) {
          for (const [tipoNombre, val] of Object.entries(edificioInput.distribucion)) {
            if (typeof val === "number") {
              for (let i = 0; i < val; i++) allTowerUnits.push({ tipoNombre, sentido: null });
            } else {
              for (let i = 0; i < (val.derecha ?? 0); i++) allTowerUnits.push({ tipoNombre, sentido: "derecha" });
              for (let i = 0; i < (val.izquierda ?? 0); i++) allTowerUnits.push({ tipoNombre, sentido: "izquierda" });
            }
          }
        } else {
          const firstTipo = Object.keys(tipoMap)[0];
          const total = (edificioInput.unidadesPorPiso ?? 4) * edificioInput.pisos;
          for (let i = 0; i < total; i++) allTowerUnits.push({ tipoNombre: firstTipo, sentido: null });
        }

        const udsPerFloor = edificioInput.unidadesPorPiso ?? (allTowerUnits.length > 0 ? Math.ceil(allTowerUnits.length / edificioInput.pisos) : 4);
        let unitIdx = 0;

        for (let p = 1; p <= edificioInput.pisos; p++) {
          const piso = await tx.piso.create({
            data: { edificio_id: edificio.id, numero: p },
          });

          const customUnits = edificioInput.unidades_detalle?.[String(p)];

          if (customUnits && customUnits.length > 0) {
            for (const cu of customUnits) {
              const tipoInfo = tipoMap[cu.tipo_unidad];
              if (!tipoInfo) continue;
              const unidad = await tx.unidad.create({
                data: {
                  piso_id: piso.id,
                  nombre: cu.nombre,
                  tipo_unidad_id: tipoInfo.id,
                  sentido: cu.sentido || null,
                  nombre_personalizado: cu.nombre_personalizado || null,
                  ...(tipoInfo.metraje_total != null ? { metraje_total: tipoInfo.metraje_total } : {}),
                },
              });
              await createEspaciosYTareas(tx, unidad.id, tipoInfo, cu.tipo_unidad, edificioInput.nombre, cu.nombre);
            }
          } else {
            for (let slot = 0; slot < udsPerFloor; slot++) {
              const spec = allTowerUnits[unitIdx];
              if (!spec) break;
              const tipoInfo = tipoMap[spec.tipoNombre];
              if (!tipoInfo) { unitIdx++; continue; }
              const unitName = `${p}0${slot + 1}`;
              const unidad = await tx.unidad.create({
                data: {
                  piso_id: piso.id,
                  nombre: unitName,
                  tipo_unidad_id: tipoInfo.id,
                  sentido: spec.sentido,
                  ...(tipoInfo.metraje_total != null ? { metraje_total: tipoInfo.metraje_total } : {}),
                },
              });
              unitIdx++;
              await createEspaciosYTareas(tx, unidad.id, tipoInfo, spec.tipoNombre, edificioInput.nombre, unitName);
            }
          }
        }

        // Helper: create espacios and tareas for a unit
        async function createEspaciosYTareas(
          tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
          unidadId: string,
          tipoInfo: { id: string; espacios: string[]; metrajes_espacios?: Record<string, number> },
          tipoNombre: string,
          torreNombre: string,
          unidadNombre: string,
        ) {
          for (let idxEspacio = 0; idxEspacio < tipoInfo.espacios.length; idxEspacio++) {
            const nombreEspacio = tipoInfo.espacios[idxEspacio];
            const espacioMetraje =
              tipoInfo.metrajes_espacios?.[nombreEspacio] ?? METRAJE_ESPACIO_DEFECTO;
            // Same key the prediction pass used for this (tipo, espacio).
            const claveEsp = claveEspacioWizard(tipoNombre, idxEspacio);
            const espacio = await tx.espacio.create({
              data: { unidad_id: unidadId, nombre: nombreEspacio, metraje: espacioMetraje },
            });

            // Filter tasks: for Madera tasks with tipo_unidad_id, only apply if matching
            const tareasDelEspacio = (body.tareas ?? []).filter((t) => {
              if (t.espacio !== nombreEspacio) return false;
              if (t.tipo_unidad_id && t.tipo_unidad_id !== tipoNombre) return false;
              return true;
            });

            for (const t of tareasDelEspacio) {
              const isMadera = t.fase === "Madera";

              // Instalación (or the only record for non-Madera)
              const diasInstalacion = calcDias(t.tiempo_acordado_dias, t.fase);
              const subfaseInstalacion = isMadera ? "Instalación" : (t.subfase ?? null);
              tareaSeq++;
              await tx.tarea.create({
                data: {
                  espacio_id: espacio.id,
                  fase_id: fasesCreadas[t.fase],
                  numero_registro: generarNumeroTarea(numeroRegistro, tareaSeq),
                  nombre: t.nombre,
                  subfase: subfaseInstalacion,
                  tiempo_acordado_dias: diasInstalacion,
                  codigo_referencia: t.codigo_referencia ?? null,
                  marca_linea: t.marca_linea ?? null,
                  componentes: t.componentes ?? null,
                  asignado_a: resolveContratista(body.asignaciones, { fase: t.fase, nombre: t.nombre, subfase: subfaseInstalacion }, torreNombre, unidadNombre, nombreEspacio, t.asignado_a ?? contratistaDefault?.id ?? null),
                  precio: t.precio ?? null,
                  tiene_estructura: t.tiene_estructura ?? (isMadera ? true : false),
                  tiene_nave: t.tiene_nave ?? (isMadera ? true : false),
                  tiene_chapa: t.tiene_chapa ?? false,
                  tiene_cartera: t.tiene_cartera ?? false,
                  estado: "PENDIENTE",
                },
              });
              acumularPreRegistro(claveEsp, {
                nombre: t.nombre,
                fase: t.fase,
                dias: diasInstalacion,
                metraje: espacioMetraje,
              });

              // Detallado y lustro (Madera only, unless excluded)
              if (isMadera && !t.lustro_excluido) {
                const diasLustro = calcDias(t.lustro_dias ?? t.tiempo_acordado_dias, t.fase);
                tareaSeq++;
                await tx.tarea.create({
                  data: {
                    espacio_id: espacio.id,
                    fase_id: fasesCreadas[t.fase],
                    numero_registro: generarNumeroTarea(numeroRegistro, tareaSeq),
                    nombre: t.nombre,
                    subfase: "Detallado y lustro",
                    tiempo_acordado_dias: diasLustro,
                    codigo_referencia: t.codigo_referencia ?? null,
                    marca_linea: t.marca_linea ?? null,
                    componentes: t.componentes ?? null,
                    asignado_a: resolveContratista(body.asignaciones, { fase: t.fase, nombre: t.nombre, subfase: "Detallado y lustro" }, torreNombre, unidadNombre, nombreEspacio, t.asignado_a ?? contratistaDefault?.id ?? null),
                    precio: t.lustro_precio ?? null,
                    tiene_estructura: t.tiene_estructura ?? true,
                    tiene_nave: t.tiene_nave ?? true,
                    tiene_chapa: t.tiene_chapa ?? false,
                    tiene_cartera: t.tiene_cartera ?? false,
                    estado: "PENDIENTE",
                  },
                });
                // Instalación y lustro comparten nombre: el motor no distingue
                // subfases, así que ambas filas llevan la misma predicción. Cada
                // aprobación consume una y el multiset queda intacto.
                acumularPreRegistro(claveEsp, {
                  nombre: t.nombre,
                  fase: t.fase,
                  dias: diasLustro,
                  metraje: espacioMetraje,
                });
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
        for (let idxZona = 0; idxZona < zonasComunes.length; idxZona++) {
          const nombreZona = zonasComunes[idxZona];
          const claveZona = claveEspacioWizard("zc", idxZona);
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
            tareaSeq++;
            await tx.tarea.create({
              data: {
                espacio_id: espacioZC.id,
                fase_id: faseZonasId,
                numero_registro: generarNumeroTarea(numeroRegistro, tareaSeq),
                nombre: t.nombre,
                tiempo_acordado_dias: t.tiempo_acordado_dias,
                asignado_a: contratistaDefault?.id ?? null,
                estado: "PENDIENTE",
              },
            });
            acumularPreRegistro(claveZona, {
              nombre: t.nombre,
              fase: "Zonas Comunes",
              dias: t.tiempo_acordado_dias,
              metraje: zcMetraje ?? null,
            });
          }
        }
      }

      // Personas vinculadas
      if (body.personas && body.personas.length > 0) {
        const personasData = body.personas
          .filter((p) => p.nombre.trim().length > 0)
          .slice(0, 20)
          .map((p) => ({
            proyecto_id: proyecto.id,
            nombre: p.nombre.trim().slice(0, 100),
            cargo: p.cargo.trim().slice(0, 100),
            email: p.email?.trim().slice(0, 200) || null,
          }));
        if (personasData.length > 0) {
          await tx.personaExternaProyecto.createMany({ data: personasData });
        }
      }

      return proyecto;
    }, { timeout: 60000 });

    // Tripwire: if the engine predicted something and NOT ONE pre-registro came
    // out, the prediction pass and the creation pass stopped walking the same
    // indices. That is the only way this fails silently, so shout about it.
    if (
      preRegistrosDuracion.length === 0 &&
      [...prediccionesDuracion.values()].some((p) => p.diasMotor != null)
    ) {
      console.warn(
        "wizard: the engine predicted tasks but no pre-registro was produced. " +
          "Check the espacio/tarea key alignment (claveEspacioWizard).",
      );
    }

    // Duration pre-registros with the engine's prediction (outside the tx,
    // never critical: a failure here cannot break project creation).
    await flushPreRegistrosDuracion(
      preRegistrosDuracion,
      proyectoCreado.id,
      currentUser.constructora_id,
    );

    // Learn tasks for this constructora (fire-and-forget, don't block response)
    if (body.tareas && body.tareas.length > 0) {
      aprenderTareas(currentUser.constructora_id, body.tareas).catch((err) =>
        console.error("Learning failed (non-blocking):", err),
      );
    }

    return NextResponse.json(proyectoCreado, { status: 201 });
  } catch (error) {
    console.error("POST /api/proyectos/wizard failed:", error);
    const msg = error instanceof Error ? error.message : "Error creando proyecto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
