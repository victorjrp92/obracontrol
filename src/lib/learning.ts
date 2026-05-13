import { prisma } from "@/lib/prisma";
import type { TaskTemplate } from "@/lib/task-templates";

interface TareaParaAprender {
  fase: string;
  subfase?: string;
  espacio: string;
  nombre: string;
  tiempo_acordado_dias: number;
  precio?: number;
  marca_linea?: string;
  componentes?: string;
}

const MAX_NO_USO = 3;

export async function aprenderTareas(
  constructoraId: string,
  tareas: TareaParaAprender[],
) {
  const keys = new Set(
    tareas.map((t) => `${t.fase}||${t.espacio}||${t.nombre}`),
  );

  const existentes = await prisma.tareaAprendida.findMany({
    where: { constructora_id: constructoraId },
    select: { id: true, fase: true, espacio: true, nombre: true },
  });

  const idsUsadas: string[] = [];
  const idsNoUsadas: string[] = [];
  for (const e of existentes) {
    const key = `${e.fase}||${e.espacio}||${e.nombre}`;
    if (keys.has(key)) {
      idsUsadas.push(e.id);
    } else {
      idsNoUsadas.push(e.id);
    }
  }

  const existenteKeys = new Set(
    existentes.map((e) => `${e.fase}||${e.espacio}||${e.nombre}`),
  );

  const nuevas = tareas.filter(
    (t) => !existenteKeys.has(`${t.fase}||${t.espacio}||${t.nombre}`),
  );

  await prisma.$transaction([
    // Reset counter for used tasks
    ...(idsUsadas.length > 0
      ? [prisma.tareaAprendida.updateMany({
          where: { id: { in: idsUsadas } },
          data: { proyectos_sin_uso_consecutivos: 0 },
        })]
      : []),

    // Increment counter for unused tasks
    ...(idsNoUsadas.length > 0
      ? [prisma.tareaAprendida.updateMany({
          where: { id: { in: idsNoUsadas } },
          data: { proyectos_sin_uso_consecutivos: { increment: 1 } },
        })]
      : []),

    // Create new learned tasks
    ...nuevas.map((t) =>
      prisma.tareaAprendida.create({
        data: {
          constructora_id: constructoraId,
          fase: t.fase,
          subfase: t.subfase ?? null,
          espacio: t.espacio,
          nombre: t.nombre,
          tiempo_acordado_dias: t.tiempo_acordado_dias,
          precio: t.precio ?? null,
          marca_linea: t.marca_linea ?? null,
          componentes: t.componentes ?? null,
        },
      }),
    ),

    // Purge tasks not used in MAX_NO_USO consecutive projects
    prisma.tareaAprendida.deleteMany({
      where: {
        constructora_id: constructoraId,
        proyectos_sin_uso_consecutivos: { gte: MAX_NO_USO },
      },
    }),
  ]);
}

export async function obtenerTareasAprendidas(
  constructoraId: string,
): Promise<Record<string, Record<string, TaskTemplate[]>>> {
  const rows = await prisma.tareaAprendida.findMany({
    where: { constructora_id: constructoraId },
    orderBy: { nombre: "asc" },
  });

  const result: Record<string, Record<string, TaskTemplate[]>> = {};
  for (const r of rows) {
    if (!result[r.fase]) result[r.fase] = {};
    if (!result[r.fase][r.espacio]) result[r.fase][r.espacio] = [];
    result[r.fase][r.espacio].push({
      nombre: r.nombre,
      tiempo_acordado_dias: r.tiempo_acordado_dias,
      subfase: r.subfase ?? undefined,
      precio: r.precio ?? undefined,
      marca_linea: r.marca_linea ?? undefined,
      componentes: r.componentes ?? undefined,
    });
  }
  return result;
}
