import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getContratistaProyectos } from "@/lib/data-contratista";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import SugerirTareaForm from "@/components/dashboard/SugerirTareaForm";

export default async function SugerirPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  // Get projects where the contratista has tasks
  const proyectosBase = await getContratistaProyectos(usuario.id);

  // Enrich each project with edificios and unidades
  const proyectos = await Promise.all(
    proyectosBase.map(async (p) => {
      const edificios = await prisma.edificio.findMany({
        where: { proyecto_id: p.id },
        select: {
          id: true,
          nombre: true,
          pisos: {
            select: {
              unidades: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
        orderBy: { nombre: "asc" },
      });

      // Flatten pisos -> unidades
      const edificiosConUnidades = edificios.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        unidades: e.pisos.flatMap((piso) => piso.unidades),
      }));

      return {
        id: p.id,
        nombre: p.nombre,
        edificios: edificiosConUnidades,
      };
    })
  );

  return (
    <>
      <Topbar title="Sugerir tarea" subtitle="Propone nuevas tareas al equipo de administración" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-xl">
          <p className="text-sm text-slate-500 mb-5">
            Si identificas trabajo adicional que no está en tu lista de tareas, puedes sugerirlo aquí. El equipo lo revisará y lo aprobará o rechazará.
          </p>
          <SugerirTareaForm proyectos={proyectos} />
        </div>
      </main>
    </>
  );
}
