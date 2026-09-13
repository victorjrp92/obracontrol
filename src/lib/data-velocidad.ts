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

  const filas = await prisma.tarea.findMany({
    where: {
      espacio: {
        unidad: {
          piso: {
            edificio: {
              proyecto_id: proyectoId,
              proyecto: { constructora_id: constructoraId },
            },
          },
        },
      },
    },
    select: {
      estado: true,
      tiempo_acordado_dias: true,
      fecha_inicio: true,
      fecha_fin_real: true,
      fase: { select: { nombre: true, orden: true } },
      asignado_usuario: { select: { nombre: true } },
      espacio: {
        select: {
          unidad: {
            select: {
              id: true,
              tipo_unidad: { select: { nombre: true } },
              piso: {
                select: {
                  numero: true,
                  edificio: { select: { nombre: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const tareas = filas.map((t) => ({
    estado: t.estado,
    tiempo_acordado_dias: t.tiempo_acordado_dias,
    fecha_inicio: t.fecha_inicio ? t.fecha_inicio.toISOString() : null,
    fecha_fin_real: t.fecha_fin_real ? t.fecha_fin_real.toISOString() : null,
    fase: t.fase.nombre,
    faseOrden: t.fase.orden,
    unidadId: t.espacio.unidad.id,
    torre: t.espacio.unidad.piso.edificio.nombre,
    // El piso se etiqueta con texto y no con el numero crudo para que la
    // columna de la matriz se lea sola: "Piso 3", no "3".
    piso: `Piso ${t.espacio.unidad.piso.numero}`,
    tipologia: t.espacio.unidad.tipo_unidad?.nombre ?? "Sin tipologia",
    responsable: t.asignado_usuario?.nombre ?? "Sin asignar",
  }));

  return {
    tareas,
    // `DIAS_HABILES_SEMANA_DEFECTO` es 6, la jornada tipica de obra en
    // Colombia. Solo se usa si la obra no la declaro.
    diasHabilesSemana: proyecto?.dias_habiles_semana ?? DIAS_HABILES_SEMANA_DEFECTO,
  };
}
