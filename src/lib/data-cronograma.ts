import { prisma } from "@/lib/prisma";
import { fechaCorta } from "@/lib/cronograma/fechas";
import {
  avanceEjecutado,
  compararAvance,
  conteoDesde,
  diferenciaPuntos,
  estadoDeFase,
  fraccionProgramada,
  ritmoDeSPI,
  tiempoTranscurrido,
  totalTareas,
  type Cobertura,
  type ConteoEstados,
  type EstadoFase,
  type FasePlaneada,
  type Ritmo,
  type TiempoObra,
} from "@/lib/avance-programado";

// ---------------------------------------------------------------------------
// Carga del CRONOGRAMA de una obra, fusionado con su avance real.
//
// Devuelve una estructura YA CALCULADA y serializable (fechas en ISO): la
// aritmetica vive en `avance-programado.ts`, que es puro y verificable, y el
// componente solo pinta. Asi el calculo no viaja al navegador ni se recalcula
// en cada render.
//
// == POR QUE `groupBy` Y NO TRAER LAS TAREAS ================================
//
// La obra de tres torres tiene 4.110 tareas. Traerlas para contarlas por fase
// y estado son 4.110 filas cruzando la red para producir 40 numeros, en una
// pagina que ya venia lenta y se acaba de optimizar. `groupBy` por fase y
// estado devuelve esas 40 filas y el conteo lo hace Postgres.
//
// == TENANT ================================================================
//
// El filtro va por `constructora_id` ADEMAS del id del proyecto: con solo el
// id, uno adivinado devolveria el cronograma de otra constructora. En el
// `groupBy` el scope viaja por `fase.proyecto`, que es el mismo limite de
// tenant y ademas la dimension por la que se agrupa — una tarea cuya fase sea
// de otro proyecto queda fuera por construccion.
//
// == DINERO ================================================================
//
// Todos los `select` son explicitos. Un `include` aqui arrastraria `precio` y
// `presupuesto_*` hasta el cliente; ver `sin-dinero.ts`, que existe justo
// porque eso ya paso.
// ---------------------------------------------------------------------------

/** Una fase con su ventana planeada, su avance y su veredicto. Fechas en ISO. */
export interface FaseCronograma {
  id: string;
  nombre: string;
  orden: number;
  inicioPlan: string | null;
  finPlan: string | null;
  /** «3 feb – 28 mar», ya formateado en el servidor. `null` = sin ventana. */
  ventanaTexto: string | null;
  total: number;
  conteos: ConteoEstados;
  /** Avance ejecutado con reglas de credito, 0-1. `null` = fase sin tareas. */
  ejecutado: number | null;
  /** Avance que tocaba hoy, 0-1. `null` = fase sin ventana planeada. */
  programado: number | null;
  /** ejecutado - programado, en puntos porcentuales. */
  diferencia: number | null;
  estado: EstadoFase;
}

/**
 * Por que NO se puede calcular el avance programado. Se enumera en vez de
 * devolver un simple `null` porque la pantalla tiene que decir QUE FALTA: un
 * guion mudo deja al usuario pensando que la app se rompio.
 */
export type MotivoSinCronograma =
  /** La obra no tiene fecha de inicio o de fin estimada. */
  | "SIN_FECHAS_OBRA"
  /** La obra no tiene fases cargadas. */
  | "SIN_FASES"
  /** Hay fases, pero ninguna tiene ventana planeada. El caso de toda obra vieja. */
  | "SIN_VENTANAS_FASE"
  /** Solo algunas fases tienen ventana: el programado cubre una parte de la obra. */
  | "CRONOGRAMA_PARCIAL"
  /** Las columnas del cronograma no existen todavia en esta base de datos. */
  | "ESQUEMA_PENDIENTE";

export interface ResumenCronograma {
  proyectoId: string;
  proyectoNombre: string;
  /** El dia con el que se calculo todo, en ISO. Se fija en el servidor para que
   *  el cliente no recalcule con otro reloj y pinte una linea de hoy distinta. */
  hoy: string;
  inicioObra: string | null;
  finObra: string | null;
  /** «3 ene – 7 jun 2027»: el plazo de la obra, ya formateado. */
  plazoTexto: string | null;
  tiempo: TiempoObra | null;
  /** Avance ejecutado de toda la obra, 0-1. */
  ejecutado: number | null;
  /** Solo aprobado, 0-1: la cifra que ya enseña el resto de la app. */
  aprobado: number | null;
  /** Avance programado, 0-1. `null` cuando no hay cronograma — NO cero. */
  programado: number | null;
  /** El ejecutado restringido a las fases con ventana: el numerador del SPI. */
  ejecutadoComparable: number | null;
  spi: number | null;
  ritmo: Ritmo | null;
  conteos: ConteoEstados;
  cobertura: Cobertura;
  faltantes: MotivoSinCronograma[];
  fases: FaseCronograma[];
}

/** Fila cruda de fase, con la ventana ya normalizada a `Date | null`. */
interface FilaFase {
  id: string;
  nombre: string;
  orden: number;
  fecha_inicio_plan: Date | null;
  fecha_fin_plan: Date | null;
}

/**
 * P2022 = «la columna no existe en la base actual». Pasa mientras la migracion
 * `20260914150000_cronograma_planeado` este en el repo pero no aplicada.
 *
 * Se detecta por codigo y no por mensaje, y NO se traga cualquier error: si el
 * fallo fuera de conexion, la consulta de respaldo de abajo vuelve a fallar y
 * el error sube igual. Sin esta guarda, Reportes devuelve 500 a todo el mundo
 * entre el despliegue del codigo y el `prisma migrate deploy`.
 */
function esColumnaFaltante(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2022";
}

/**
 * «3 feb – 28 mar», con el ano solo cuando no es el de hoy: una obra de dos
 * anos no puede prometer un mes sin decir cual, y repetir el ano en curso en
 * cada una de las diez filas es ruido.
 *
 * Se formatea en el SERVIDOR: el componente es cliente, y meter ahi el modulo
 * de fechas del cronograma arrastraria al bundle la probabilidad y el
 * Monte Carlo que cuelgan de el.
 */
function textoVentana(inicio: Date, fin: Date, hoy: Date): string {
  const anioHoy = hoy.getUTCFullYear();
  const etiqueta = (d: Date) =>
    d.getUTCFullYear() === anioHoy ? fechaCorta(d) : `${fechaCorta(d)} ${d.getUTCFullYear()}`;
  return `${etiqueta(inicio)} – ${etiqueta(fin)}`;
}

export async function getResumenCronograma(
  proyectoId: string,
  constructoraId: string,
  hoy: Date = new Date(),
): Promise<ResumenCronograma | null> {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: constructoraId },
    // `select` explicito: sin el, la fila entera trae `presupuesto_*`.
    select: { id: true, nombre: true, fecha_inicio: true, fecha_fin_estimada: true },
  });
  if (!proyecto) return null;

  let esquemaPendiente = false;
  let filas: FilaFase[];
  try {
    filas = await prisma.fase.findMany({
      where: { proyecto_id: proyectoId, proyecto: { constructora_id: constructoraId } },
      select: {
        id: true,
        nombre: true,
        orden: true,
        fecha_inicio_plan: true,
        fecha_fin_plan: true,
      },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });
  } catch (e) {
    if (!esColumnaFaltante(e)) throw e;
    esquemaPendiente = true;
    const base = await prisma.fase.findMany({
      where: { proyecto_id: proyectoId, proyecto: { constructora_id: constructoraId } },
      select: { id: true, nombre: true, orden: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    });
    filas = base.map((f) => ({ ...f, fecha_inicio_plan: null, fecha_fin_plan: null }));
  }

  // Los 40 numeros que necesita la pantalla, contados en Postgres.
  const grupos = await prisma.tarea.groupBy({
    by: ["fase_id", "estado"],
    where: { fase: { proyecto_id: proyectoId, proyecto: { constructora_id: constructoraId } } },
    _count: { _all: true },
  });

  const porFase = new Map<string, { estado: string; cantidad: number }[]>();
  for (const g of grupos) {
    const lista = porFase.get(g.fase_id) ?? [];
    lista.push({ estado: g.estado, cantidad: g._count._all });
    porFase.set(g.fase_id, lista);
  }

  const planeadas: FasePlaneada[] = filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    orden: f.orden,
    inicioPlan: f.fecha_inicio_plan,
    finPlan: f.fecha_fin_plan,
    conteos: conteoDesde(porFase.get(f.id) ?? []),
  }));

  const comparacion = compararAvance(planeadas, hoy);

  const fases: FaseCronograma[] = planeadas.map((f) => {
    const ejecutado = avanceEjecutado(f.conteos);
    const programado = fraccionProgramada(hoy, f.inicioPlan, f.finPlan);
    return {
      id: f.id,
      nombre: f.nombre,
      orden: f.orden,
      inicioPlan: f.inicioPlan ? f.inicioPlan.toISOString() : null,
      finPlan: f.finPlan ? f.finPlan.toISOString() : null,
      ventanaTexto: f.inicioPlan && f.finPlan ? textoVentana(f.inicioPlan, f.finPlan, hoy) : null,
      total: totalTareas(f.conteos),
      conteos: f.conteos,
      ejecutado,
      programado,
      diferencia: diferenciaPuntos(ejecutado, programado),
      estado: estadoDeFase(f.conteos, ejecutado, programado),
    };
  });

  const faltantes: MotivoSinCronograma[] = [];
  if (esquemaPendiente) faltantes.push("ESQUEMA_PENDIENTE");
  if (filas.length === 0) faltantes.push("SIN_FASES");
  else if (comparacion.cobertura.fasesConVentana === 0) faltantes.push("SIN_VENTANAS_FASE");
  else if (comparacion.cobertura.fasesSinVentana > 0) faltantes.push("CRONOGRAMA_PARCIAL");
  if (!proyecto.fecha_inicio || !proyecto.fecha_fin_estimada) faltantes.push("SIN_FECHAS_OBRA");

  return {
    proyectoId: proyecto.id,
    proyectoNombre: proyecto.nombre,
    hoy: hoy.toISOString(),
    inicioObra: proyecto.fecha_inicio ? proyecto.fecha_inicio.toISOString() : null,
    finObra: proyecto.fecha_fin_estimada ? proyecto.fecha_fin_estimada.toISOString() : null,
    plazoTexto:
      proyecto.fecha_inicio && proyecto.fecha_fin_estimada
        ? textoVentana(proyecto.fecha_inicio, proyecto.fecha_fin_estimada, hoy)
        : null,
    tiempo: tiempoTranscurrido(hoy, proyecto.fecha_inicio, proyecto.fecha_fin_estimada),
    ejecutado: comparacion.ejecutado,
    aprobado: comparacion.aprobado,
    programado: comparacion.programado,
    ejecutadoComparable: comparacion.ejecutadoComparable,
    spi: comparacion.spi,
    ritmo: ritmoDeSPI(comparacion.spi),
    conteos: comparacion.conteos,
    cobertura: comparacion.cobertura,
    faltantes,
    fases,
  };
}
