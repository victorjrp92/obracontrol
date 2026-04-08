import { prisma } from "@/lib/prisma";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";

export async function getProyectoDetalle(proyectoId: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: {
      fases: { orderBy: { orden: "asc" } },
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
                    include: {
                      tareas: {
                        include: {
                          asignado_usuario: { select: { id: true, nombre: true } },
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

  const todasTareas = proyecto.edificios.flatMap((e) =>
    e.pisos.flatMap((pi) => pi.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
  );
  const progreso = calcularProgreso(todasTareas);

  return { ...proyecto, progreso, totalTareas: todasTareas.length };
}

export async function getTareaDetalle(tareaId: string) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: {
      espacio: {
        include: {
          unidad: {
            include: { piso: { include: { edificio: { include: { proyecto: true } } } } },
          },
        },
      },
      fase: true,
      asignado_usuario: {
        select: {
          id: true,
          nombre: true,
          rol: true,
          contratista_perfil: { select: { id: true } },
        },
      },
      evidencias: { orderBy: { created_at: "desc" } },
      aprobaciones: {
        orderBy: { fecha: "desc" },
        include: { aprobador: { select: { nombre: true } } },
      },
      retrasos: { orderBy: { created_at: "desc" } },
    },
  });
  if (!tarea) return null;

  const proyecto = tarea.espacio.unidad.piso.edificio.proyecto;
  const inicio = tarea.fecha_inicio ?? tarea.created_at;
  const ahora = new Date();
  const diasTranscurridos = calcularDiasHabiles(inicio, ahora, proyecto.dias_habiles_semana);
  const semaforo = calcularSemaforo(tarea.tiempo_acordado_dias, diasTranscurridos, tarea.estado === "APROBADA");
  const diasRestantes = tarea.tiempo_acordado_dias - diasTranscurridos;

  return {
    ...tarea,
    proyecto,
    ubicacion: `${tarea.espacio.unidad.piso.edificio.nombre} · Piso ${tarea.espacio.unidad.piso.numero} · Apto ${tarea.espacio.unidad.nombre} · ${tarea.espacio.nombre}`,
    semaforo,
    diasTranscurridos,
    diasRestantes,
  };
}
