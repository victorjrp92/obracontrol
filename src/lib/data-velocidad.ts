import { prisma } from "@/lib/prisma";
import type { TareaVelocidad } from "@/lib/velocidad";
import { DIAS_HABILES_SEMANA_DEFECTO } from "@/lib/calendario-colombia";

// ---------------------------------------------------------------------------
// Carga de tareas para el reporte de velocidad.
//
// Va aparte de `getProyectoDetalle` a proposito: aquel trae el arbol completo
// -edificios, pisos, unidades, espacios y sus tareas anidadas- porque la
// pantalla del proyecto lo dibuja. Aqui solo hacen falta las tareas con cuatro
// etiquetas planas, y traerlas planas sobre una obra de cuatro mil tareas es
// bastante mas barato que armar y recorrer el arbol.
//
// El filtro de tenant va por `proyecto.constructora_id` ademas del id del
// proyecto: con solo el id, un id adivinado de otra constructora devolveria
// sus tareas.
// ---------------------------------------------------------------------------

/** Lo que el componente necesita: fechas ya en ISO para poder cruzar al cliente. */
export interface TareaVelocidadSerializada
  extends Omit<TareaVelocidad, "fecha_inicio" | "fecha_fin_real"> {
  fecha_inicio: string | null;
  fecha_fin_real: string | null;
}

/** Las tareas mas la jornada del proyecto, que es con la que se miden. */
export interface DatosVelocidad {
  tareas: TareaVelocidadSerializada[];
  /** `Proyecto.dias_habiles_semana`. Sin el, medir en dias habiles seria adivinar. */
  diasHabilesSemana: number;
}

export async function getTareasVelocidad(
  proyectoId: string,
  constructoraId: string,
): Promise<DatosVelocidad> {
  // La jornada viaja con las tareas: la duracion real de una tarea depende de
  // cuantos dias por semana trabaja ESTA obra, y una obra de seis dias no se
  // puede medir con el calendario de una de cinco.
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: constructoraId },
    select: { dias_habiles_semana: true },
  });

  // UNA sola consulta con joins, en vez del `select` anidado de Prisma.
  //
  // POR QUE: Prisma resuelve cada nivel de un `select` anidado como una
  // consulta aparte y luego las cose en memoria. Sobre las 4.110 tareas de una
  // obra de tres torres eso medía 2.139 ms, frente a 609 ms de las mismas filas
  // sin el arbol: metro y medio de segundo de puro cosido, antes de pintar
  // nada. Aqui todo lo que hace falta son cinco etiquetas planas -fase,
  // responsable, torre, piso y tipologia- que un join trae de una vez.
  //
  // El filtro de tenant va por `constructora_id` ADEMAS del id del proyecto,
  // igual que antes: con solo el id, uno adivinado devolveria las tareas de
  // otra constructora.
  const filas = await prisma.$queryRaw<
    {
      estado: string;
      tiempo_acordado_dias: number;
      fecha_inicio: Date | null;
      fecha_fin_real: Date | null;
      fase_nombre: string;
      fase_orden: number;
      unidad_id: string;
      torre: string;
      piso_numero: number;
      tipologia: string | null;
      responsable: string | null;
    }[]
  >`
    select
      t.estado,
      t.tiempo_acordado_dias,
      t.fecha_inicio,
      t.fecha_fin_real,
      f.nombre  as fase_nombre,
      f.orden   as fase_orden,
      u.id      as unidad_id,
      ed.nombre as torre,
      pi.numero as piso_numero,
      tu.nombre as tipologia,
      us.nombre as responsable
    from tareas t
      join espacios  es on es.id = t.espacio_id
      join unidades  u  on u.id  = es.unidad_id
      join pisos     pi on pi.id = u.piso_id
      join edificios ed on ed.id = pi.edificio_id
      join proyectos pr on pr.id = ed.proyecto_id
      join fases     f  on f.id  = t.fase_id
      left join tipos_unidad tu on tu.id = u.tipo_unidad_id
      left join usuarios     us on us.id = t.asignado_a
    where pr.id = ${proyectoId} and pr.constructora_id = ${constructoraId}
  `;

  const tareas = filas.map((t) => ({
    estado: t.estado,
    tiempo_acordado_dias: t.tiempo_acordado_dias,
    fecha_inicio: t.fecha_inicio ? t.fecha_inicio.toISOString() : null,
    fecha_fin_real: t.fecha_fin_real ? t.fecha_fin_real.toISOString() : null,
    fase: t.fase_nombre,
    faseOrden: t.fase_orden,
    unidadId: t.unidad_id,
    torre: t.torre,
    // El piso se etiqueta con texto y no con el numero crudo para que la
    // columna de la matriz se lea sola: "Piso 3", no "3".
    piso: `Piso ${t.piso_numero}`,
    tipologia: t.tipologia ?? "Sin tipologia",
    responsable: t.responsable ?? "Sin asignar",
  }));

  return {
    tareas,
    // `DIAS_HABILES_SEMANA_DEFECTO` es 6, la jornada tipica de obra en
    // Colombia. Solo se usa si la obra no la declaro.
    diasHabilesSemana: proyecto?.dias_habiles_semana ?? DIAS_HABILES_SEMANA_DEFECTO,
  };
}
