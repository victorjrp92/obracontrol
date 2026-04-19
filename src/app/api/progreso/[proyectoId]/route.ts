import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { calcularProgreso, calcularSemaforo, calcularDiasHabiles } from "@/lib/scoring";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";

// GET /api/progreso/[proyectoId] — progreso ponderado completo del proyecto
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ proyectoId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const currentUser = await prisma.usuario.findUnique({
      where: { email: user.email! },
      select: { id: true, constructora_id: true, rol_ref: { select: { nivel_acceso: true } } },
    });
    if (!currentUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { proyectoId } = await params;

    // Project-access: ADMIN_PROYECTO may only see projects in their assignments.
    const accessible = await getAccessibleProjectIds(
      currentUser.id,
      currentUser.constructora_id,
      currentUser.rol_ref.nivel_acceso,
    );
    if (!canAccessProject(accessible, proyectoId)) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: {
        edificios: {
          include: {
            pisos: {
              include: {
                unidades: {
                  include: {
                    espacios: {
                      include: {
                        tareas: {
                          include: { retrasos: true },
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

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    // Tenant isolation: verify the project belongs to the user's constructora
    if (proyecto.constructora_id !== currentUser.constructora_id) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const ahora = new Date();

    // Calcular progreso y semáforo por edificio
    const edificiosData = proyecto.edificios.map((edificio) => {
      const pisosData = edificio.pisos.map((piso) => {
        const unidadesData = piso.unidades.map((unidad) => {
          const espaciosData = unidad.espacios.map((espacio) => {
            const tareas = espacio.tareas;
            const progreso = calcularProgreso(tareas);

            // Semáforo del espacio = peor semáforo entre sus tareas
            const semaforoEspacio = tareas.length === 0
              ? "verde"
              : tareas
                  .map((t) => {
                    const inicio = t.fecha_inicio ?? t.created_at;
                    const fin = t.fecha_fin_real ?? ahora;
                    const dias = calcularDiasHabiles(inicio, fin, proyecto.dias_habiles_semana);
                    return calcularSemaforo(t.tiempo_acordado_dias, dias, t.estado === "APROBADA");
                  })
                  .reduce((peor, actual) => {
                    const orden = ["verde-intenso", "verde", "amarillo", "rojo", "vinotinto"];
                    return orden.indexOf(actual) > orden.indexOf(peor) ? actual : peor;
                  }, "verde-intenso" as string);

            return { id: espacio.id, nombre: espacio.nombre, progreso, semaforo: semaforoEspacio };
          });

          const todasTareas = unidad.espacios.flatMap((e) => e.tareas);
          return {
            id: unidad.id,
            nombre: unidad.nombre,
            progreso: calcularProgreso(todasTareas),
            espacios: espaciosData,
          };
        });

        const todasTareasPiso = piso.unidades.flatMap((u) => u.espacios.flatMap((e) => e.tareas));
        return {
          id: piso.id,
          numero: piso.numero,
          progreso: calcularProgreso(todasTareasPiso),
          unidades: unidadesData,
        };
      });

      const todasTareasEdificio = edificio.pisos.flatMap((p) =>
        p.unidades.flatMap((u) => u.espacios.flatMap((e) => e.tareas))
      );
      return {
        id: edificio.id,
        nombre: edificio.nombre,
        progreso: calcularProgreso(todasTareasEdificio),
        pisos: pisosData,
      };
    });

    const todasTareasProyecto = proyecto.edificios.flatMap((e) =>
      e.pisos.flatMap((p) => p.unidades.flatMap((u) => u.espacios.flatMap((es) => es.tareas)))
    );

    return NextResponse.json({
      proyecto_id: proyectoId,
      progreso: calcularProgreso(todasTareasProyecto),
      edificios: edificiosData,
    });
  } catch (error) {
    console.error("GET /api/progreso/[proyectoId]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
