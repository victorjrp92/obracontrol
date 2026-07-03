// ─────────────────────────────────────────────────────────────────────────
// Flywheel de DURACIONES (RegistroDuracion) — espejo de precios-mercado.ts.
//
// ESCRITURA (captura pasiva): `capturarDuracionAprobada` deja el rastro de
// días reales vs. estimados cuando una tarea pasa a APROBADA con fecha_inicio
// y fecha de fin real. SIEMPRE en try/catch: un fallo aquí (p. ej. tabla aún
// no migrada) JAMÁS rompe la aprobación — mismo patrón que
// flushPreciosCapturados.
//
// Aplica a TODAS las cuentas (B2B y B2C), decisión deliberada: las obras B2B
// son hoy la mayor fuente de aprobaciones reales (más volumen para el
// flywheel) y cada registro queda etiquetado con constructora_id/proyecto_id,
// así que una lectura futura puede filtrar por segmento si hiciera falta.
//
// LECTURA: `getDuracionMercado` devuelve la MEDIANA de días reales por tarea
// normalizada (+ ciudad si hay muestra). Defensivo y SIN conectar a la UI
// todavía: el motor determinista (estimar-duracion.ts) es la fuente por ahora.
// ─────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { normalizarTarea } from "@/lib/normalizar-tarea";
import { faseDeTarea } from "@/lib/fases-obra";

const MAX_MUESTRA = 500;
/** Sanidad: duraciones reales por tarea > 2 años son basura de datos. */
const MAX_DIAS_REALES = 730;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Captura pasiva del flywheel: registra los días reales vs. estimados de una
 * tarea recién APROBADA. Requiere que la tarea tenga `fecha_inicio` y
 * `fecha_fin_real`; si falta cualquiera, no registra (sin error).
 *
 * Nunca lanza: cualquier fallo se degrada a un console.warn (telemetría, no
 * parte del flujo). Llamar DESPUÉS de la transacción de aprobación.
 */
export async function capturarDuracionAprobada(tareaId: string): Promise<void> {
  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      select: {
        nombre: true,
        tiempo_acordado_dias: true,
        fecha_inicio: true,
        fecha_fin_real: true,
        fase: { select: { nombre: true } },
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
                          select: { id: true, ciudad: true, constructora_id: true },
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
    if (!tarea?.fecha_inicio || !tarea.fecha_fin_real) return;

    const ms = tarea.fecha_fin_real.getTime() - tarea.fecha_inicio.getTime();
    if (ms < 0) return; // datos inconsistentes: no registrar
    // Días calendario con mínimo 0.5 (una tarea de horas cuenta como media jornada).
    const diasReales = Math.max(0.5, Math.round((ms / MS_POR_DIA) * 10) / 10);
    if (diasReales > MAX_DIAS_REALES) return;

    const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;

    await prisma.registroDuracion.create({
      data: {
        tarea_normalizada: normalizarTarea(tarea.nombre),
        // Fase curada si el matcher la reconoce; si no, la fase de la obra.
        fase: (faseDeTarea(tarea.nombre) ?? tarea.fase.nombre).slice(0, 80),
        ciudad: proyecto.ciudad,
        metraje: tarea.espacio.metraje,
        dias_estimados: tarea.tiempo_acordado_dias,
        dias_reales: diasReales,
        proyecto_id: proyecto.id,
        constructora_id: proyecto.constructora_id,
      },
    });
  } catch (err) {
    // No es crítico: el flywheel de duraciones es telemetría.
    console.warn("capturarDuracionAprobada falló (no crítico):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Lectura
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
 * Duración de mercado para una tarea (ya normalizada con `normalizarTarea`)
 * en una ciudad opcional: mediana de los días reales registrados. Prioriza la
 * muestra de la ciudad; si no hay, cae al agregado global de la tarea.
 * Defensivo (tabla sin migrar u otro fallo → null). NO conectado a la UI.
 */
export async function getDuracionMercado(
  tareaNormalizada: string,
  ciudad?: string | null,
): Promise<DuracionMercado | null> {
  const clave = tareaNormalizada.trim();
  if (!clave) return null;

  const ciudadNorm = ciudad?.trim() || null;
  const wheres = ciudadNorm
    ? [{ tarea_normalizada: clave, ciudad: ciudadNorm }, { tarea_normalizada: clave }]
    : [{ tarea_normalizada: clave }];

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
