// ─────────────────────────────────────────────────────────────────────────
// Flywheel de DURACIONES (RegistroDuracion) — espejo de precios-mercado.ts.
//
// ══ QUÉ SE MIDE Y POR QUÉ (Fase 0 del rediseño del motor) ══════════════════
//
// Hasta esta versión la tabla medía las variables EQUIVOCADAS:
//
//  1. `dias_reales` medía LATENCIA DE APROBACIÓN, no duración.
//     `Tarea.fecha_inicio` se escribe cuando el obrero REPORTA la tarea ya
//     terminada (api/tareas/[id]/reportar) y `fecha_fin_real` cuando el
//     supervisor la APRUEBA (api/tareas/[id]/aprobar). El intervalo entre
//     ambas es el tiempo que tarda alguien en mirar dos fotos: 0.5–2 días para
//     cualquier clase de tarea, hasta para una placa de concreto.
//     FIX: el inicio real sale de `min(Evidencia.timestamp_captura)` — la marca
//     de tiempo del dispositivo con que se documentó el trabajo, el dato más
//     cercano al momento en que se trabajó de verdad y con CERO fricción para
//     el obrero. `fecha_inicio` queda solo como respaldo.
//
//  2. `dias_estimados` mide EL PLAN DEL USUARIO, no la predicción del motor.
//     `repartirGlobal()` (IntentWizard) sobrescribe los días de cada tarea con
//     el reparto del plazo que puso el usuario, y eso es lo que se persiste en
//     `Tarea.tiempo_acordado_dias`. Es un dato útil —«lo que se acordó»— pero
//     NO sirve para evaluar el algoritmo.
//     FIX: `dias_motor` guarda lo que predijo `estimarDuracion` AL CREAR el
//     proyecto. Sin esa separación no se puede calcular el error del motor.
//
//  3. Todo estaba en días CALENDARIO, sin descontar los días no laborables.
//     FIX: `dias_reales_habiles` usa el `dias_habiles_semana` del proyecto (que
//     vale 6 por defecto: la construcción colombiana trabaja Lu–Sá).
//     `dias_reales` se conserva en calendario para no romper nada.
//
//  4. Un registro sin CANTIDAD no es comparable con otro: pintar 12 m² y pintar
//     120 m² no son la misma observación y su mediana no significa nada.
//     FIX: se guardan `cantidad`, `unidad` y `cuadrillas`. (El defecto de
//     normalización de `getDuracionMercado` sigue abierto a propósito: ver el
//     bloque de LECTURA al final.)
//
// ══ CICLO DE VIDA DE UNA FILA ══════════════════════════════════════════════
//
//   crear proyecto  →  PRE-REGISTRO  (dias_motor + cantidad + unidad +
//                                     cuadrillas; dias_reales = 0 = «aún no
//                                     ejecutada»)
//   aprobar tarea   →  COMPLETADO    (dias_reales + dias_reales_habiles +
//                                     dias_estimados vigentes al aprobar)
//
// Las filas pendientes (`dias_reales <= 0`) NUNCA entran en las lecturas: son
// predicción sin observación. Si al aprobar no existe pre-registro (obra creada
// antes de esta versión, o tarea añadida al editar) se crea una fila completa
// con `dias_motor = null`: retrocompatible, solo pierde el error del motor para
// esa tarea.
//
// ESCRITURA: SIEMPRE en try/catch. Un fallo aquí (p. ej. tabla aún no migrada)
// JAMÁS puede romper la aprobación de una tarea ni la creación de una obra —
// mismo patrón que flushPreciosCapturados. Es telemetría, no parte del flujo.
//
// Aplica a TODAS las cuentas (B2B y B2C), decisión deliberada: las obras B2B
// son hoy la mayor fuente de aprobaciones reales (más volumen para el flywheel)
// y cada registro queda etiquetado con constructora_id/proyecto_id, así que una
// lectura futura puede filtrar por segmento si hiciera falta.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { normalizarTarea } from "@/lib/normalizar-tarea";
import { faseDeTarea } from "@/lib/fases-obra";
import { estimarDuracion } from "@/lib/estimar-duracion";
import { esFestivo } from "@/lib/calendario-colombia";
import {
  cantidadPorUnidad,
  distribuirAreaTotal,
  type EspacioEstim,
} from "@/lib/estimar-presupuesto";
import { RENDIMIENTOS, type UnidadRendimiento } from "@/lib/rendimientos";

const MAX_MUESTRA = 500;
/** Sanidad: duraciones reales por tarea > 2 años son basura de datos. */
const MAX_DIAS_REALES = 730;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
/** Piso de medio día: una tarea de horas cuenta como media jornada. */
const MINIMO_DIAS = 0.5;

/**
 * Centinela de `dias_reales` para una fila PRE-REGISTRADA (predicción del motor
 * sin ejecución todavía). Se usa 0 y no un negativo porque una duración
 * negativa parece corrupción de datos; 0 se lee como «sin medir». Toda lectura
 * exige `dias_reales > 0`.
 */
export const DIAS_REALES_PENDIENTE = 0;

/** Unidad con la que se guarda la cantidad (contrato de `RegistroDuracion`). */
export type UnidadRegistro = "m2" | "ml" | "un";

function esFecha(v: unknown): v is Date {
  return v instanceof Date && Number.isFinite(v.getTime());
}

function aDecima(d: number): number {
  return Math.round(d * 10) / 10;
}

/** `UnidadRendimiento` → el contrato de `RegistroDuracion.unidad`. */
export function unidadDeRegistro(unidad: UnidadRendimiento): UnidadRegistro {
  return unidad === "unidad" ? "un" : unidad;
}

// ─────────────────────────────────────────────────────────────────────────
// Calendario: días hábiles
// ─────────────────────────────────────────────────────────────────────────

/**
 * Días de la semana que NO se trabajan, dado el `dias_habiles_semana` del
 * proyecto (1–7; **6 por defecto**, no 5: la construcción colombiana trabaja
 * lunes a sábado). El descanso se asigna desde el final de la semana: primero
 * el domingo, luego el sábado, luego el viernes…
 *
 * Los números son los de `Date.getUTCDay()` (0 = domingo).
 */
export function diasDescansoSemana(diasHabilesSemana: number): Set<number> {
  const s = Number.isFinite(diasHabilesSemana)
    ? Math.min(7, Math.max(1, Math.round(diasHabilesSemana)))
    : 6;
  const ordenDescanso = [0, 6, 5, 4, 3, 2, 1]; // domingo, sábado, viernes…
  return new Set(ordenDescanso.slice(0, 7 - s));
}

/**
 * Días HÁBILES transcurridos entre dos instantes: los días calendario menos los
 * días de descanso COMPLETOS contenidos en el intervalo.
 *
 * Se calcula en UTC para ser determinista en cualquier máquina (Colombia es
 * UTC−5 y no tiene horario de verano; a granularidad de día la diferencia solo
 * importa en las 5 h alrededor de medianoche).
 *
 * ⚠️ FALTAN LOS FESTIVOS. Colombia tiene 18 festivos al año (6–7% del
 * calendario) y hoy NO existe ningún calendario de festivos en el repo — llega
 * en otro leaf. PUNTO DE ENCHUFE: cuando exista un `esFestivo(fecha)`, basta
 * Descuenta domingos, los días no laborables de la semana del proyecto Y los
 * 18 festivos colombianos (`calendario-colombia.ts`). Devuelve días
 * FRACCIONARIOS a propósito: una tarea puede durar media jornada, y redondear
 * a entero metería un error del mismo orden que el sesgo que queremos medir.
 */
export function diasHabilesEntre(
  inicio: Date,
  fin: Date,
  diasHabilesSemana: number,
): number {
  const ms = fin.getTime() - inicio.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;

  const descanso = diasDescansoSemana(diasHabilesSemana);
  const diasCalendario = ms / MS_POR_DIA;
  if (descanso.size === 0) return diasCalendario; // semana de 7 días

  // Primera medianoche UTC en o después de `inicio`.
  const cursor = new Date(inicio.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  if (cursor.getTime() < inicio.getTime()) cursor.setUTCDate(cursor.getUTCDate() + 1);

  let noLaborables = 0;
  const tope = MAX_DIAS_REALES + 2; // guarda contra intervalos absurdos
  for (let i = 0; i < tope; i++) {
    // Solo cuenta si el día CABE ENTERO dentro del intervalo.
    if (cursor.getTime() + MS_POR_DIA > fin.getTime()) break;
    // Los festivos cuentan como no laborables igual que el domingo. Sin esto,
    // una tarea que abarca Semana Santa mide tres días más de los que se
    // trabajaron — y este módulo existe justo para no medir de más.
    if (descanso.has(cursor.getUTCDay()) || esFestivo(cursor)) noLaborables++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return Math.max(0, diasCalendario - noLaborables);
}

// ─────────────────────────────────────────────────────────────────────────
// Predicción del motor (PRE-REGISTRO, al crear el proyecto)
// ─────────────────────────────────────────────────────────────────────────

/** Lo que el motor predijo para UNA tarea dentro de UN espacio. */
export interface PrediccionTarea {
  /**
   * Días que `estimarDuracion` asigna a la tarea. Es la duración de TAREA: NO
   * incluye los factores que el motor aplica al AGREGAR la fase (cuadrilla
   * única ×1.4, imprevistos ×1.2). Quien calcule el sesgo `B` del motor debe
   * compararlo contra eso y no contra el total de la obra.
   *
   * `null` cuando el motor NO tuvo rendimiento para la tarea: en ese caso
   * `estimarDuracion` cae a los días que puso el usuario, así que registrarlo
   * como predicción sería medir al usuario otra vez — justo el defecto que esta
   * fase corrige.
   */
  diasMotor: number | null;
  /** Cantidad física de obra (m² de pared, ml de mueble, unidades). */
  cantidad: number | null;
  unidad: UnidadRegistro | null;
}

/** Clave estable espacio+tarea dentro de una predicción. */
export function clavePrediccion(espacioId: string, nombreTarea: string): string {
  return `${espacioId}\u0000${normalizarTarea(nombreTarea)}`;
}

/**
 * Corre el motor determinista sobre los espacios de una obra y devuelve, por
 * espacio+tarea, lo que predijo. PURA: no toca DB, ni red, ni reloj.
 *
 * Detalle de implementación: `estimarDuracion` identifica cada tarea de salida
 * por el NOMBRE del espacio, y en una obra real hay muchos espacios con el
 * mismo nombre ("Cocina" en cada apto). Por eso se le pasa una copia con
 * nombres únicos (`"Cocina #12"`); el sufijo no altera el `areaTipica()` del
 * espacio —que busca por substring— y permite mapear cada salida a su id.
 */
export function predecirDuracionesMotor(
  espacios: EspacioEstim[],
  opts: { areaTotal?: number; cuadrillas?: number } = {},
): Map<string, PrediccionTarea> {
  const salida = new Map<string, PrediccionTarea>();
  if (espacios.length === 0) return salida;

  // El reparto del área total va ANTES de renombrar: se indexa por id.
  const conArea =
    opts.areaTotal && opts.areaTotal > 0
      ? distribuirAreaTotal(espacios, opts.areaTotal)
      : espacios;

  const porNombreUnico = new Map<string, EspacioEstim>();
  const unicos: EspacioEstim[] = conArea.map((e, i) => {
    const copia: EspacioEstim = { ...e, nombre: `${e.nombre} #${i}` };
    porNombreUnico.set(copia.nombre, copia);
    return copia;
  });

  const resultado = estimarDuracion(unicos, {
    cuadrillas: Math.max(1, Math.round(opts.cuadrillas ?? 1)),
  });

  for (const fase of resultado.fases) {
    for (const t of fase.tareas) {
      const esp = porNombreUnico.get(t.espacio);
      if (!esp) continue;

      const rend = t.key ? RENDIMIENTOS[t.key] : undefined;
      salida.set(clavePrediccion(esp.id, t.nombre), {
        diasMotor: t.conDato && rend ? t.dias : null,
        cantidad: rend ? cantidadPorUnidad(rend.key, rend.unidad, esp) : null,
        unidad: rend ? unidadDeRegistro(rend.unidad) : null,
      });
    }
  }

  return salida;
}

/** Una fila de `RegistroDuracion` pre-creada al nacer el proyecto. */
export interface PreRegistroDuracion {
  tarea_normalizada: string;
  fase: string;
  ciudad: string | null;
  metraje: number | null;
  /** Lo que el usuario acordó (`Tarea.tiempo_acordado_dias`) al crear la obra. */
  dias_estimados: number;
  dias_motor: number;
  cantidad: number | null;
  unidad: string | null;
  cuadrillas: number;
}

/**
 * Arma la fila de pre-registro de una tarea. PURA. Devuelve `null` cuando no hay
 * nada que registrar: sin predicción del motor la fila solo repetiría el plan
 * del usuario y dejaría un pendiente eterno en la tabla.
 */
export function construirPreRegistro(input: {
  nombreTarea: string;
  faseProyecto: string;
  diasAcordados: number;
  metraje?: number | null;
  ciudad?: string | null;
  cuadrillas?: number;
  prediccion?: PrediccionTarea;
}): PreRegistroDuracion | null {
  const nombre = input.nombreTarea?.trim();
  if (!nombre) return null;

  const p = input.prediccion;
  if (!p || p.diasMotor == null || !Number.isFinite(p.diasMotor) || p.diasMotor <= 0) {
    return null;
  }

  const metraje =
    typeof input.metraje === "number" && Number.isFinite(input.metraje) && input.metraje > 0
      ? input.metraje
      : null;

  return {
    tarea_normalizada: normalizarTarea(nombre),
    // Fase curada si el matcher la reconoce; si no, la fase de la obra.
    fase: (faseDeTarea(nombre) ?? input.faseProyecto).slice(0, 80),
    ciudad: input.ciudad?.trim() || null,
    metraje,
    dias_estimados: Math.max(0, input.diasAcordados || 0),
    // Sin redondear: `dias_motor` es una PREDICCIÓN calculada, no una medición
    // de campo. Recortarla a una décima metería un error de hasta un 4% en las
    // tareas cortas, que es del mismo orden que el sesgo que se quiere medir.
    dias_motor: p.diasMotor,
    cantidad:
      p.cantidad != null && Number.isFinite(p.cantidad) && p.cantidad > 0
        ? aDecima(p.cantidad)
        : null,
    unidad: p.unidad,
    cuadrillas: Math.max(1, Math.round(input.cuadrillas ?? 1)),
  };
}

/**
 * Persiste en batch los pre-registros de duración de una obra recién creada.
 * SIEMPRE en try/catch y FUERA de la transacción principal: un fallo aquí
 * (p. ej. tabla aún no migrada) NUNCA debe romper la creación de la obra.
 * Mismo patrón que `flushPreciosCapturados`.
 */
export async function flushPreRegistrosDuracion(
  filas: PreRegistroDuracion[],
  proyectoId: string,
  constructoraId: string,
): Promise<void> {
  if (filas.length === 0) return;
  try {
    await prisma.registroDuracion.createMany({
      data: filas.map((f) => ({
        ...f,
        dias_reales: DIAS_REALES_PENDIENTE,
        proyecto_id: proyectoId,
        constructora_id: constructoraId,
      })),
    });
  } catch (err) {
    // No es crítico: el flywheel de duraciones es telemetría.
    console.warn("flushPreRegistrosDuracion falló (no crítico):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Captura al aprobar
// ─────────────────────────────────────────────────────────────────────────

/**
 * Inicio REAL del trabajo: la marca de tiempo más antigua de las evidencias.
 *
 * Las evidencias se capturan con el reloj del dispositivo en el momento de
 * documentar el trabajo, así que es el dato más cercano al momento en que se
 * trabajó de verdad y no le cuesta un solo tap al obrero. `fecha_inicio` es
 * solo respaldo: se escribe cuando el obrero REPORTA la tarea ya terminada, o
 * sea que mide el final, no el principio.
 *
 * Defensivo contra relojes de dispositivo corruptos: se descartan las marcas
 * posteriores al fin y las anteriores en más de `MAX_DIAS_REALES`.
 */
export function inicioRealDeTarea(
  fechaInicio: Date | null | undefined,
  timestampsEvidencia: readonly (Date | null | undefined)[] | null | undefined,
  fechaFinReal?: Date | null,
): Date | null {
  const fin = esFecha(fechaFinReal) ? fechaFinReal.getTime() : null;
  let minimo: Date | null = null;

  for (const t of timestampsEvidencia ?? []) {
    if (!esFecha(t)) continue;
    if (fin != null) {
      const delta = fin - t.getTime();
      if (delta < 0) continue; // reloj adelantado: la evidencia "ocurre" tras el fin
      if (delta > MAX_DIAS_REALES * MS_POR_DIA) continue; // reloj atrasado años
    }
    if (!minimo || t.getTime() < minimo.getTime()) minimo = t;
  }

  if (minimo) return minimo;
  return esFecha(fechaInicio) ? fechaInicio : null;
}

/** Lo que la captura necesita saber de una tarea recién aprobada. */
export interface DatosTareaCaptura {
  nombre: string;
  /** `Tarea.tiempo_acordado_dias` vigente al aprobar = el plan del usuario. */
  diasAcordados: number;
  fechaInicio: Date | null;
  fechaFinReal: Date | null;
  /** Marcas de tiempo de las evidencias de la tarea (reloj del dispositivo). */
  timestampsEvidencia: (Date | null)[];
  faseProyecto: string;
  metraje: number | null;
  ciudad: string | null;
  /** `Proyecto.dias_habiles_semana` — 6 por defecto en este producto. */
  diasHabilesSemana: number;
  proyectoId: string;
  constructoraId: string;
}

/** Los campos que la aprobación MIDE (el resto ya vive en el pre-registro). */
export interface MedicionDuracion {
  tarea_normalizada: string;
  fase: string;
  ciudad: string | null;
  metraje: number | null;
  dias_estimados: number;
  /** Días CALENDARIO (se conserva: es lo que ya leen los consumidores). */
  dias_reales: number;
  /** Días HÁBILES según `dias_habiles_semana` del proyecto. Sin festivos aún. */
  dias_reales_habiles: number;
  /** De dónde salió el inicio: sirve para auditar la calidad del dato. */
  origenInicio: "evidencia" | "fecha_inicio";
}

/**
 * Arma la medición de una tarea aprobada. PURA: sin DB, sin reloj. Devuelve
 * `null` cuando no hay nada medible (sin fin, sin inicio, fechas invertidas o
 * duración absurda). Nunca lanza, ni con datos corruptos.
 */
export function construirMedicion(datos: DatosTareaCaptura): MedicionDuracion | null {
  const nombre = datos?.nombre?.trim();
  if (!nombre) return null;
  if (!esFecha(datos.fechaFinReal)) return null;
  const fin = datos.fechaFinReal;

  const inicio = inicioRealDeTarea(datos.fechaInicio, datos.timestampsEvidencia, fin);
  if (!inicio) return null;

  const ms = fin.getTime() - inicio.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null; // datos inconsistentes

  const diasReales = Math.max(MINIMO_DIAS, aDecima(ms / MS_POR_DIA));
  if (diasReales > MAX_DIAS_REALES) return null;

  const habiles = diasHabilesEntre(inicio, fin, datos.diasHabilesSemana);
  // Los hábiles nunca superan al calendario, y comparten el piso de medio día.
  const diasHabiles = Math.min(diasReales, Math.max(MINIMO_DIAS, aDecima(habiles)));

  const desdeEvidencia = (datos.timestampsEvidencia ?? []).some(
    (t) => esFecha(t) && t.getTime() === inicio.getTime(),
  );

  return {
    tarea_normalizada: normalizarTarea(nombre),
    // Fase curada si el matcher la reconoce; si no, la fase de la obra.
    fase: (faseDeTarea(nombre) ?? datos.faseProyecto).slice(0, 80),
    ciudad: datos.ciudad?.trim() || null,
    metraje:
      typeof datos.metraje === "number" && Number.isFinite(datos.metraje) && datos.metraje > 0
        ? datos.metraje
        : null,
    dias_estimados: Math.max(0, datos.diasAcordados || 0),
    dias_reales: diasReales,
    dias_reales_habiles: diasHabiles,
    origenInicio: desdeEvidencia ? "evidencia" : "fecha_inicio",
  };
}

/**
 * Puertos de datos de la captura. Existen para poder verificarla SIN base de
 * datos: `scripts/verificar-medicion-duracion.ts` inyecta puertos que lanzan
 * para probar que la aprobación de una tarea nunca se rompe.
 */
export interface PuertosCaptura {
  leerTarea(tareaId: string): Promise<DatosTareaCaptura | null>;
  /** Completa el pre-registro pendiente de esa tarea. `false` si no había. */
  completarPreRegistro(datos: DatosTareaCaptura, medicion: MedicionDuracion): Promise<boolean>;
  /** Crea la fila completa cuando no existe pre-registro (retrocompatible). */
  crearRegistro(datos: DatosTareaCaptura, medicion: MedicionDuracion): Promise<void>;
}

/** Tolerancia al comparar el metraje de dos filas (m²). */
const EPS_METRAJE = 0.01;

const puertosPrisma: PuertosCaptura = {
  async leerTarea(tareaId) {
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      select: {
        nombre: true,
        tiempo_acordado_dias: true,
        fecha_inicio: true,
        fecha_fin_real: true,
        fase: { select: { nombre: true } },
        // Las 5 más antiguas bastan: aprobar exige mínimo 2 fotos y con 5
        // candidatas se sobrevive a un puñado de relojes de dispositivo rotos.
        evidencias: {
          select: { timestamp_captura: true },
          orderBy: { timestamp_captura: "asc" },
          take: 5,
        },
        espacio: {
          select: {
            metraje: true,
            unidad: {
              select: {
                piso: {
                  select: {
                    edificio: {
                      select: {
                        proyecto: {
                          select: {
                            id: true,
                            ciudad: true,
                            constructora_id: true,
                            dias_habiles_semana: true,
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
    if (!tarea) return null;

    const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;
    return {
      nombre: tarea.nombre,
      diasAcordados: tarea.tiempo_acordado_dias,
      fechaInicio: tarea.fecha_inicio,
      fechaFinReal: tarea.fecha_fin_real,
      timestampsEvidencia: tarea.evidencias.map((e) => e.timestamp_captura),
      faseProyecto: tarea.fase.nombre,
      metraje: tarea.espacio.metraje,
      ciudad: proyecto.ciudad,
      diasHabilesSemana: proyecto.dias_habiles_semana,
      proyectoId: proyecto.id,
      constructoraId: proyecto.constructora_id,
    };
  },

  async completarPreRegistro(datos, medicion) {
    // Pendientes de ESTA obra con ESTE nombre de tarea. Se prefiere el que
    // coincide en metraje (desambigua "Pintura" de la cocina vs. la de la
    // sala); si ninguno coincide, el más antiguo. El emparejamiento fila a fila
    // puede no ser exacto entre espacios homónimos del mismo metraje, pero el
    // MULTISET de `dias_motor` que consume la obra sí lo es, y eso es lo que
    // necesita cualquier métrica agregada (MALE, sesgo B).
    const pendientes = await prisma.registroDuracion.findMany({
      where: {
        proyecto_id: datos.proyectoId,
        tarea_normalizada: medicion.tarea_normalizada,
        dias_reales: { lte: DIAS_REALES_PENDIENTE },
      },
      select: { id: true, metraje: true },
      orderBy: { created_at: "asc" },
      take: 20,
    });
    if (pendientes.length === 0) return false;

    const elegido =
      pendientes.find(
        (p) =>
          medicion.metraje != null &&
          p.metraje != null &&
          Math.abs(p.metraje - medicion.metraje) < EPS_METRAJE,
      ) ?? pendientes[0];

    await prisma.registroDuracion.update({
      where: { id: elegido.id },
      data: {
        fase: medicion.fase,
        ciudad: medicion.ciudad,
        metraje: medicion.metraje,
        dias_estimados: medicion.dias_estimados,
        dias_reales: medicion.dias_reales,
        dias_reales_habiles: medicion.dias_reales_habiles,
      },
    });
    return true;
  },

  async crearRegistro(datos, medicion) {
    await prisma.registroDuracion.create({
      data: {
        tarea_normalizada: medicion.tarea_normalizada,
        fase: medicion.fase,
        ciudad: medicion.ciudad,
        metraje: medicion.metraje,
        dias_estimados: medicion.dias_estimados,
        dias_reales: medicion.dias_reales,
        dias_reales_habiles: medicion.dias_reales_habiles,
        // Sin pre-registro no hay predicción del motor que comparar.
        dias_motor: null,
        proyecto_id: datos.proyectoId,
        constructora_id: datos.constructoraId,
      },
    });
  },
};

/**
 * Captura pasiva del flywheel: mide una tarea recién APROBADA y completa su
 * pre-registro (o crea la fila si no lo hay).
 *
 * NUNCA lanza: cualquier fallo se degrada a un console.warn (telemetría, no
 * parte del flujo). Llamar DESPUÉS de la transacción de aprobación.
 */
export async function capturarDuracionAprobada(
  tareaId: string,
  puertos: PuertosCaptura = puertosPrisma,
): Promise<void> {
  try {
    const datos = await puertos.leerTarea(tareaId);
    if (!datos) return;

    const medicion = construirMedicion(datos);
    if (!medicion) return;

    const completado = await puertos.completarPreRegistro(datos, medicion);
    if (!completado) await puertos.crearRegistro(datos, medicion);
  } catch (err) {
    // No es crítico: el flywheel de duraciones es telemetría.
    console.warn("capturarDuracionAprobada falló (no crítico):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Lectura
//
// ⚠️ DEFECTO CONCEPTUAL ABIERTO — NO NORMALIZA POR CANTIDAD.
// `getDuracionMercado` devuelve la mediana de DÍAS por tarea normalizada. Un
// registro de "pintura" de 12 m² y otro de 120 m² entran con el mismo peso y su
// mediana no describe ninguna obra real: promedia dos observaciones que no son
// comparables. Lo correcto es medir el RENDIMIENTO (cantidad ÷ días hábiles) y
// devolver días para la cantidad concreta que se pregunta:
//
//     rendimiento_i = cantidad_i / dias_reales_habiles_i      [m²/día]
//     dias(Q)       = Q / mediana({ rendimiento_i })
//
// Desde esta versión ya se guardan `cantidad`, `unidad` y `dias_reales_habiles`,
// que es todo lo que hace falta. NO se arregla aquí A PROPÓSITO: los registros
// históricos tienen esos campos en null, así que primero hay que acumular
// muestra nueva; y el arreglo pertenece a la fase estadística, que además exige
// shrinkage hacia la semilla. Por eso `getDuracionMercado` sigue SIN conectarse
// a la UI: el motor determinista es la fuente.
// ─────────────────────────────────────────────────────────────────────────

export type ConfianzaDuracion = "alta" | "media" | "baja";

export interface DuracionMercado {
  /** Días reales típicos (mediana). */
  dias: number;
  /** # de registros que respaldan el dato. */
  n: number;
  confianza: ConfianzaDuracion;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  const m =
    ordenados.length % 2 === 0
      ? (ordenados[mitad - 1] + ordenados[mitad]) / 2
      : ordenados[mitad];
  return Math.round(m * 10) / 10;
}

/**
 * Duración de mercado para una tarea (ya normalizada con `normalizarTarea`) en
 * una ciudad opcional: mediana de los días reales registrados. Prioriza la
 * muestra de la ciudad; si no hay, cae al agregado global de la tarea.
 * Defensivo (tabla sin migrar u otro fallo → null). NO conectado a la UI.
 *
 * Excluye en el WHERE las filas PRE-REGISTRADAS (`dias_reales <= 0`): son
 * predicción del motor sin ejecución. Filtrarlas después del `take` dejaría a
 * una obra grande recién creada tapando toda la muestra.
 */
export async function getDuracionMercado(
  tareaNormalizada: string,
  ciudad?: string | null,
): Promise<DuracionMercado | null> {
  const clave = tareaNormalizada.trim();
  if (!clave) return null;

  const ciudadNorm = ciudad?.trim() || null;
  const soloMedidos = { dias_reales: { gt: DIAS_REALES_PENDIENTE } };
  const wheres = ciudadNorm
    ? [
        { tarea_normalizada: clave, ciudad: ciudadNorm, ...soloMedidos },
        { tarea_normalizada: clave, ...soloMedidos },
      ]
    : [{ tarea_normalizada: clave, ...soloMedidos }];

  for (const where of wheres) {
    let registros;
    try {
      registros = await prisma.registroDuracion.findMany({
        where,
        select: { dias_reales: true },
        take: MAX_MUESTRA,
        orderBy: { created_at: "desc" },
      });
    } catch {
      // Tabla aún no migrada u otro fallo de lectura: no es crítico.
      return null;
    }

    const muestras = registros
      .map((r) => r.dias_reales)
      .filter((d) => Number.isFinite(d) && d > 0 && d <= MAX_DIAS_REALES);
    if (muestras.length === 0) continue;

    const n = muestras.length;
    let confianza: ConfianzaDuracion = "baja";
    if (n >= 8) confianza = "alta";
    else if (n >= 3) confianza = "media";

    return { dias: mediana(muestras), n, confianza };
  }

  return null;
}
