import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { extractMotivo } from "@/lib/aprobaciones";
import {
  autorDeEvidencia,
  horasRevision,
  motivoLimpio,
  notaVisible,
  numerarIntentos,
  ordenarSucesos,
  rangoFechas,
  resumenBitacora,
  SUCESOS_POR_PAGINA,
  type DecisionResumen,
  type EvidenciaAutor,
  type PersonaEsperada,
  type ResumenBitacora,
  type SucesoBitacora,
  idsPrimeraDecisionPorTarea,
} from "@/lib/bitacora";

// ---------------------------------------------------------------------------
// Carga de la bitacora de obra. La aritmetica vive en `@/lib/bitacora`; aqui
// solo se consulta y se pega el contexto.
//
// == POR QUE TRES CONSULTAS Y NO UNA ========================================
//
// La obra tiene 11.533 tareas y 2.399 decisiones. Traerlas juntas con su arbol
// -espacio, unidad, piso, edificio, fase, aprobador, evidencias- es una pagina
// que no carga. La reparticion es:
//
//   · La LINEA de la bitacora se pagina (`SUCESOS_POR_PAGINA`): solo las 50
//     decisiones de la pagina traen el arbol completo.
//   · El RESUMEN no se puede paginar -una media sobre media pagina no es una
//     media- pero si se puede adelgazar: cinco columnas escalares por decision,
//     sin un solo join de texto. Eso son cuatro numeros por fila, no un arbol.
//   · Los NOMBRES de los aprobadores se resuelven aparte, en una consulta de
//     cinco filas, en vez de repetirse 2.399 veces dentro del resumen.
//
// == TENANT =================================================================
//
// Todas las consultas cuelgan del mismo camino `edificio -> proyecto`, que
// filtra por `proyecto_id` Y por `constructora_id`. Con solo el id del
// proyecto, uno adivinado devolveria la bitacora de otra constructora — y esta
// pantalla dice quien aprobo que, que es justo lo que no se puede filtrar.
// ---------------------------------------------------------------------------

/**
 * Tope de seguridad del resumen. Hoy la obra mas cargada tiene 2.399
 * decisiones, asi que nunca se toca; esta para que el dia que una obra llegue a
 * cien mil la pantalla se degrade avisando en vez de tumbar el servidor.
 */
const MAX_FILAS_RESUMEN = 20_000;

/** Niveles que pueden firmar una decision y por tanto deben salir en la tabla. */
const NIVELES_QUE_APRUEBAN = ["ADMIN_GENERAL", "DIRECTIVO"] as const;

export interface FiltrosBitacora {
  /** `Usuario.id` del aprobador. */
  persona?: string;
  /** `Fase.id`. */
  fase?: string;
  /** `Edificio.id`. */
  torre?: string;
  /** `YYYY-MM-DD`. */
  desde?: string;
  hasta?: string;
}

export interface OpcionFiltro {
  id: string;
  nombre: string;
}

export interface DatosBitacora {
  sucesos: SucesoBitacora[];
  resumen: ResumenBitacora;
  /** Decisiones que cumplen el filtro, no las de la pagina. */
  totalSucesos: number;
  pagina: number;
  paginas: number;
  /** Opciones de los desplegables: salen de la OBRA, no del filtro activo. */
  personas: OpcionFiltro[];
  fases: OpcionFiltro[];
  torres: OpcionFiltro[];
  /** `true` si el resumen choco con `MAX_FILAS_RESUMEN` y no cubre el periodo entero. */
  resumenTruncado: boolean;
}

export async function getBitacora(
  proyectoId: string,
  constructoraId: string,
  filtros: FiltrosBitacora,
  paginaPedida: number,
): Promise<DatosBitacora> {
  const { desde, hasta } = rangoFechas(filtros.desde, filtros.hasta);

  // El id del edificio va DENTRO del filtro de edificio y no en un `espacio`
  // aparte: dos claves `espacio` en el mismo objeto se pisarian y el filtro de
  // torre se perderia sin error.
  const edificioObra: Prisma.EdificioWhereInput = {
    proyecto_id: proyectoId,
    proyecto: { constructora_id: constructoraId },
  };
  const tareaObra: Prisma.TareaWhereInput = {
    espacio: { unidad: { piso: { edificio: edificioObra } } },
  };
  /** Todo lo de la obra, sin filtros: de aqui salen las opciones de los desplegables. */
  const whereObra: Prisma.AprobacionWhereInput = { tarea: tareaObra };

  const tareaFiltrada: Prisma.TareaWhereInput = {
    espacio: {
      unidad: {
        piso: { edificio: { ...edificioObra, ...(filtros.torre ? { id: filtros.torre } : {}) } },
      },
    },
    ...(filtros.fase ? { fase_id: filtros.fase } : {}),
  };
  const where: Prisma.AprobacionWhereInput = {
    tarea: tareaFiltrada,
    ...(filtros.persona ? { aprobador_id: filtros.persona } : {}),
    ...(desde || hasta
      ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : {}),
  };

  const [totalSucesos, filasResumen, aprobadoresDeLaObra, historiaCompleta, fases, torres, candidatos] =
    await Promise.all([
      prisma.aprobacion.count({ where }),
      // Ascendente a proposito: si algun dia el tope recorta, lo que se
      // conserva son las decisiones MAS ANTIGUAS, que son las primeras de cada
      // tarea — las unicas que miden latencia. Recortar por el otro lado
      // dejaria el resumen sin ninguna latencia que calcular.
      prisma.aprobacion.findMany({
        where,
        select: {
          id: true,
          tarea_id: true,
          aprobador_id: true,
          estado: true,
          fecha: true,
          tarea: { select: { fecha_inicio: true } },
        },
        orderBy: [{ fecha: "asc" }, { id: "asc" }],
        take: MAX_FILAS_RESUMEN,
      }),
      // Solo los ids distintos de quien firmo algo en la obra: es la lista del
      // desplegable de personas, y tiene que salir de la OBRA y no del filtro
      // activo — si saliera del resultado filtrado, elegir a alguien vaciaria la
      // lista y ya no habria forma de cambiar de persona.
      prisma.aprobacion.groupBy({ by: ["aprobador_id"], where: whereObra }),
      // La historia COMPLETA de decisiones de la obra, SIN los filtros de
      // persona ni de fechas. Solo sirve para saber cual fue la PRIMERA
      // decision de cada tarea, que es la unica que mide tiempo de revision.
      // Calcularlo sobre el conjunto filtrado ascendia un reintento a
      // «primera» y le cargaba al revisor los meses que el contratista tardo en
      // rehacer el trabajo. Son tres columnas escalares: barato aunque la obra
      // tenga miles de decisiones.
      prisma.aprobacion.findMany({
        where: whereObra,
        select: { id: true, tarea_id: true, fecha: true },
        orderBy: { fecha: "asc" },
        take: MAX_FILAS_RESUMEN,
      }),
      prisma.fase.findMany({
        where: { proyecto_id: proyectoId, proyecto: { constructora_id: constructoraId } },
        select: { id: true, nombre: true },
        orderBy: { orden: "asc" },
      }),
      prisma.edificio.findMany({
        where: edificioObra,
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
      // Quien PUEDE aprobar en esta obra. El admin de proyecto entra solo si
      // tiene la obra asignada; el general y el directivo, siempre. SUPER_ADMIN
      // queda fuera adrede: es personal de Seiricon, no del cliente, y meterlo
      // en la tabla de rendimiento del cliente seria un dato que no es suyo.
      prisma.usuario.findMany({
        where: {
          constructora_id: constructoraId,
          OR: [
            { rol_ref: { nivel_acceso: { in: [...NIVELES_QUE_APRUEBAN] } } },
            {
              rol_ref: { nivel_acceso: "ADMIN_PROYECTO" },
              proyectos_administrados: { some: { proyecto_id: proyectoId } },
            },
          ],
        },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      }),
    ]);

  // Nombres: los candidatos ya traen el suyo; falta el de quien firmo alguna
  // vez y hoy ya no es candidato (cambio de rol, salio de la empresa). Sin este
  // relleno esas decisiones aparecerian firmadas por un id.
  const nombres = new Map<string, string>(candidatos.map((u) => [u.id, u.nombre]));
  const huerfanos = [...new Set(aprobadoresDeLaObra.map((a) => a.aprobador_id))].filter(
    (id) => !nombres.has(id),
  );
  if (huerfanos.length > 0) {
    const extra = await prisma.usuario.findMany({
      where: { id: { in: huerfanos }, constructora_id: constructoraId },
      select: { id: true, nombre: true },
    });
    for (const u of extra) nombres.set(u.id, u.nombre);
  }

  const decisiones: DecisionResumen[] = filasResumen.map((f) => ({
    decisionId: f.id,
    tareaId: f.tarea_id,
    aprobadorId: f.aprobador_id,
    aprobadorNombre: nombres.get(f.aprobador_id) ?? "Usuario eliminado",
    estado: f.estado,
    fechaDecision: f.fecha,
    fechaReporte: f.tarea.fecha_inicio,
  }));

  // Los ceros de la tabla solo tienen sentido cuando NO se esta filtrando por
  // persona: con el filtro puesto, un «0 decisiones» de los demas no dice que
  // no trabajen, dice que el filtro los excluyo.
  const esperadas: PersonaEsperada[] = filtros.persona ? [] : candidatos;

  // La primera decision de cada tarea, sacada de la historia entera. Es lo que
  // hace que la columna «tarda en revisar» diga lo mismo con filtro y sin el.
  const primerasDelHistorial = idsPrimeraDecisionPorTarea(
    historiaCompleta.map((h) => ({
      decisionId: h.id,
      tareaId: h.tarea_id,
      aprobadorId: "",
      aprobadorNombre: "",
      estado: "APROBADA" as const,
      fechaDecision: h.fecha,
      fechaReporte: null,
    })),
  );
  const resumen = resumenBitacora(decisiones, esperadas, primerasDelHistorial);

  const paginas = Math.max(1, Math.ceil(totalSucesos / SUCESOS_POR_PAGINA));
  const pagina = Math.min(Math.max(1, paginaPedida), paginas);

  const filas = await prisma.aprobacion.findMany({
    where,
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * SUCESOS_POR_PAGINA,
    take: SUCESOS_POR_PAGINA,
    select: {
      id: true,
      tarea_id: true,
      estado: true,
      fecha: true,
      justificacion_por_item: true,
      aprobador: { select: { nombre: true } },
      tarea: {
        select: {
          nombre: true,
          numero_registro: true,
          nota_reporte: true,
          fecha_inicio: true,
          asignado_usuario: { select: { nombre: true } },
          fase: { select: { nombre: true } },
          espacio: {
            select: {
              nombre: true,
              unidad: {
                select: {
                  nombre: true,
                  nombre_personalizado: true,
                  piso: {
                    select: { numero: true, edificio: { select: { nombre: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const tareaIds = [...new Set(filas.map((f) => f.tarea_id))];

  // Las decisiones de ESTAS tareas al completo -no solo las que pasan el
  // filtro- porque «intento 2 de 3» se cuenta sobre la historia de la tarea, y
  // las evidencias de las mismas tareas para saber quien puso la mano.
  const [decisionesDeLasTareas, evidencias] =
    tareaIds.length > 0
      ? await Promise.all([
          prisma.aprobacion.findMany({
            where: { tarea_id: { in: tareaIds } },
            select: { id: true, tarea_id: true, fecha: true },
          }),
          prisma.evidencia.findMany({
            where: { tarea_id: { in: tareaIds } },
            select: {
              tarea_id: true,
              timestamp_captura: true,
              usuario: { select: { nombre: true } },
              obrero: { select: { nombre: true } },
            },
            orderBy: { timestamp_captura: "asc" },
          }),
        ])
      : [[], []];

  const intentos = numerarIntentos(
    decisionesDeLasTareas.map((d) => ({
      decisionId: d.id,
      tareaId: d.tarea_id,
      fechaDecision: d.fecha,
    })),
  );

  const evidenciasPorTarea = new Map<string, EvidenciaAutor[]>();
  for (const e of evidencias) {
    // `tomada_por` (Usuario) u `obrero_id` (Obrero) segun el canal. Una
    // evidencia sin ninguno de los dos no dice quien, y no sirve de nada aqui.
    const nombre = e.usuario?.nombre ?? e.obrero?.nombre;
    if (!nombre) continue;
    const lista = evidenciasPorTarea.get(e.tarea_id);
    const autor: EvidenciaAutor = { nombre, timestamp: e.timestamp_captura };
    if (lista) lista.push(autor);
    else evidenciasPorTarea.set(e.tarea_id, [autor]);
  }

  const sucesos: SucesoBitacora[] = filas.map((f) => {
    const secuencia = intentos.get(f.id) ?? { intento: 1, total: 1 };
    const autor = autorDeEvidencia(evidenciasPorTarea.get(f.tarea_id) ?? [], f.fecha);
    const asignado = f.tarea.asignado_usuario?.nombre ?? null;
    const unidad = f.tarea.espacio.unidad;

    return {
      decisionId: f.id,
      tareaId: f.tarea_id,
      tareaNombre: f.tarea.nombre,
      numeroRegistro: f.tarea.numero_registro,
      fase: f.tarea.fase.nombre,
      espacio: f.tarea.espacio.nombre,
      unidad: unidad.nombre_personalizado ?? unidad.nombre,
      piso: unidad.piso.numero,
      torre: unidad.piso.edificio.nombre,
      estado: f.estado,
      fechaDecision: f.fecha,
      aprobador: f.aprobador.nombre,
      // Solo en las devoluciones: una aprobacion con texto en el Json no es un
      // motivo de rechazo y pintarlo como tal confunde.
      motivo:
        f.estado === "NO_APROBADA" ? motivoLimpio(extractMotivo(f.justificacion_por_item)) : null,
      reportadoPor: autor?.nombre ?? asignado,
      reportadoPorFuente: autor ? "evidencia" : asignado ? "asignado" : null,
      // `Tarea.fecha_inicio` se congela en el PRIMER reporte y nunca se vuelve a
      // tocar, asi que en un reintento diria «Reporto Luis el 1 de marzo»
      // cuando ese intento se reporto en agosto. Solo se ensena donde es
      // cierta. Es el mismo cuidado que ya tenia `notaVisible`, que evita
      // ponerle en la boca en marzo algo que escribio en agosto.
      fechaReporte: secuencia.intento === 1 ? f.tarea.fecha_inicio : null,
      horasRevision:
        secuencia.intento === 1 ? horasRevision(f.tarea.fecha_inicio, f.fecha) : null,
      notaReporte: notaVisible(f.tarea.nota_reporte, secuencia.intento, secuencia.total),
      intento: secuencia.intento,
      intentosTotales: secuencia.total,
    };
  });

  // Las personas del desplegable salen de la obra entera: si salieran del
  // resultado filtrado, elegir a alguien vaciaria la lista y no habria forma de
  // cambiar de persona sin borrar el filtro a mano.
  const personas: OpcionFiltro[] = [...new Set(aprobadoresDeLaObra.map((a) => a.aprobador_id))]
    .map((id) => ({ id, nombre: nombres.get(id) ?? "Usuario eliminado" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    sucesos: ordenarSucesos(sucesos),
    resumen,
    totalSucesos,
    pagina,
    paginas,
    personas,
    fases,
    torres,
    resumenTruncado: filasResumen.length === MAX_FILAS_RESUMEN,
  };
}
