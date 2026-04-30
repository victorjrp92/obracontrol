import { prisma } from "@/lib/prisma";

/**
 * Calcula los días hábiles transcurridos entre dos fechas
 * según la configuración del proyecto (5, 6 o 7 días/semana)
 */
export function calcularDiasHabiles(
  desde: Date,
  hasta: Date,
  diasSemanales: number
): number {
  let dias = 0;
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);
  const fin = new Date(hasta);
  fin.setHours(0, 0, 0, 0);

  while (cursor < fin) {
    const dow = cursor.getDay(); // 0=dom, 6=sab
    const esHabil =
      diasSemanales === 7
        ? true
        : diasSemanales === 6
        ? dow !== 0 // excluye domingo
        : dow !== 0 && dow !== 6; // excluye sab y dom
    if (esHabil) dias++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

/**
 * Determina el semáforo de una tarea según su desviación de tiempo
 */
export function calcularSemaforo(
  diasAcordados: number,
  diasTranscurridos: number,
  terminada: boolean
): "verde-intenso" | "verde" | "amarillo" | "rojo" | "vinotinto" {
  if (terminada) {
    const sobrante = (diasAcordados - diasTranscurridos) / diasAcordados;
    if (sobrante > 0.1) return "verde-intenso";
    if (sobrante >= 0) return "verde";
  }
  const retraso = (diasTranscurridos - diasAcordados) / diasAcordados;
  if (retraso <= 0) return "verde";
  if (retraso <= 0.15) return "amarillo";
  if (retraso <= 0.30) return "rojo";
  return "vinotinto";
}

/**
 * Calcula el progreso ponderado por número de tareas
 * para un conjunto de tareas
 */
export function calcularProgreso(tareas: { estado: string }[]): {
  aprobadas: number;
  reportadas: number;
  total: number;
  porcentajeAprobado: number;
  porcentajeReportado: number;
} {
  const total = tareas.length;
  if (total === 0) return { aprobadas: 0, reportadas: 0, total: 0, porcentajeAprobado: 0, porcentajeReportado: 0 };

  const aprobadas = tareas.filter((t) => t.estado === "APROBADA").length;
  const reportadas = tareas.filter(
    (t) => t.estado === "REPORTADA" || t.estado === "APROBADA"
  ).length;

  return {
    aprobadas,
    reportadas,
    total,
    porcentajeAprobado: Math.round((aprobadas / total) * 100),
    porcentajeReportado: Math.round((reportadas / total) * 100),
  };
}

/**
 * Recalcula y persiste el score total de un contratista
 * Pesos: cumplimiento 50%, calidad 30%, velocidad corrección 20%
 */
export async function recalcularScoreContratista(contratistaId: string): Promise<void> {
  const contratista = await prisma.contratista.findUnique({
    where: { id: contratistaId },
    include: {
      usuario: {
        include: {
          tareas_asignadas: {
            include: {
              retrasos: true,
              aprobaciones: { orderBy: { fecha: "asc" } },
              espacio: {
                include: {
                  unidad: {
                    include: {
                      piso: { include: { edificio: { include: { proyecto: true } } } },
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

  if (!contratista) return;

  const tareas = contratista.usuario.tareas_asignadas;
  const tareasTerminadas = tareas.filter(
    (t) => t.estado === "APROBADA" || t.estado === "NO_APROBADA"
  );

  // ── Score de cumplimiento (50%) ──────────────────────────────
  // Solo cuenta retrasos POR_CONTRATISTA u OTRO
  let scoreCumplimiento = 80; // base neutral
  if (tareasTerminadas.length > 0) {
    const desviacioones: number[] = tareasTerminadas.map((t) => {
      const diasAcordados = t.tiempo_acordado_dias;
      const inicio = t.fecha_inicio ?? t.created_at;
      const fin = t.fecha_fin_real ?? new Date();
      const diasSemanales =
        t.espacio.unidad.piso.edificio.proyecto.dias_habiles_semana;
      const diasReales = calcularDiasHabiles(inicio, fin, diasSemanales);

      // Si el retraso fue por falta de pista (sin culpa del contratista), no penaliza
      const tieneRetrasoContratista = t.retrasos.some(
        (r) => r.tipo === "POR_CONTRATISTA" || r.tipo === "OTRO"
      );
      if (!tieneRetrasoContratista && diasReales > diasAcordados) return 80;

      const pct = (diasReales - diasAcordados) / diasAcordados;
      if (pct < -0.1) return 100;
      if (pct <= 0) return 80;
      if (pct <= 0.15) return 60;
      if (pct <= 0.30) return 40;
      return 10;
    });
    scoreCumplimiento =
      desviacioones.reduce((a, b) => a + b, 0) / desviacioones.length;
  }

  // ── Score de calidad (30%) ────────────────────────────────────
  const aprobaciones = tareas.flatMap((t) => t.aprobaciones);
  const aprobadas = aprobaciones.filter((a) => a.estado === "APROBADA").length;
  const noAprobadas = aprobaciones.filter((a) => a.estado === "NO_APROBADA").length;
  const scoreCalidad =
    aprobadas + noAprobadas > 0
      ? Math.round((aprobadas / (aprobadas + noAprobadas)) * 100)
      : 80;

  // ── Score velocidad de corrección (20%) ───────────────────────
  const ciclosCorreccion: number[] = [];
  for (const tarea of tareas) {
    const aps = tarea.aprobaciones;
    for (let i = 0; i < aps.length - 1; i++) {
      if (aps[i].estado === "NO_APROBADA" && aps[i + 1]) {
        const dias =
          (aps[i + 1].fecha.getTime() - aps[i].fecha.getTime()) /
          (1000 * 60 * 60 * 24);
        ciclosCorreccion.push(dias);
      }
    }
  }
  let scoreVelocidad = 80;
  if (ciclosCorreccion.length > 0) {
    const promDias =
      ciclosCorreccion.reduce((a, b) => a + b, 0) / ciclosCorreccion.length;
    if (promDias <= 0) scoreVelocidad = 100;
    else if (promDias <= 1) scoreVelocidad = 90;
    else if (promDias <= 2) scoreVelocidad = 75;
    else if (promDias <= 3) scoreVelocidad = 60;
    else scoreVelocidad = Math.max(10, 60 - (promDias - 3) * 10);
  }

  const scoreTotal =
    scoreCumplimiento * 0.5 + scoreCalidad * 0.3 + scoreVelocidad * 0.2;

  await prisma.contratista.update({
    where: { id: contratistaId },
    data: {
      score_cumplimiento: Math.round(scoreCumplimiento),
      score_calidad: Math.round(scoreCalidad),
      score_velocidad_correccion: Math.round(scoreVelocidad),
      score_total: Math.round(scoreTotal),
    },
  });
}

/**
 * Recalcula los scores de los obreros que aportaron evidencias para una tarea.
 * Se invoca después de que un supervisor aprueba/rechaza la tarea.
 *
 * Lógica: cada evidencia se "hereda" el estado final de la tarea (APROBADA/NO_APROBADA).
 * Contamos cuántas evidencias del obrero terminaron aprobadas vs. rechazadas y
 * derivamos los 4 scores con calcularScoringObrero.
 */
export async function recalcularScoreObrerosDeTarea(tareaId: string): Promise<void> {
  // Importación tardía para evitar ciclos
  const { calcularScoringObrero } = await import("@/lib/obrero");

  // Obreros distintos que reportaron evidencia para esta tarea
  const evidencias = await prisma.evidencia.findMany({
    where: { tarea_id: tareaId, obrero_id: { not: null } },
    select: { obrero_id: true },
  });
  const obreroIds = Array.from(new Set(evidencias.map((e) => e.obrero_id!).filter(Boolean)));
  if (obreroIds.length === 0) return;

  for (const obreroId of obreroIds) {
    // Estados de las tareas a las que el obrero aportó evidencia
    const tareasDelObrero = await prisma.tarea.findMany({
      where: { evidencias: { some: { obrero_id: obreroId } } },
      select: { estado: true, fecha_fin_real: true, tiempo_acordado_dias: true, fecha_inicio: true },
    });

    const aprobadas = tareasDelObrero.filter((t) => t.estado === "APROBADA").length;
    const rechazadas = tareasDelObrero.filter((t) => t.estado === "NO_APROBADA").length;
    const completadas = aprobadas + rechazadas;

    // A tiempo: aprobadas con fecha_fin_real <= fecha_inicio + tiempo_acordado_dias
    const aTiempo = tareasDelObrero.filter((t) => {
      if (t.estado !== "APROBADA" || !t.fecha_fin_real || !t.fecha_inicio) return false;
      const limite = new Date(t.fecha_inicio.getTime() + t.tiempo_acordado_dias * 86400000);
      return t.fecha_fin_real <= limite;
    }).length;

    const scores = calcularScoringObrero({
      evidencias_aprobadas: aprobadas,
      evidencias_rechazadas: rechazadas,
      tareas_completadas: completadas,
      tareas_a_tiempo: aTiempo,
      tareas_totales: tareasDelObrero.length,
    });

    await prisma.obrero.update({
      where: { id: obreroId },
      data: {
        evidencias_aprobadas: aprobadas,
        evidencias_rechazadas: rechazadas,
        tareas_completadas: completadas,
        ...scores,
      },
    });
  }
}
