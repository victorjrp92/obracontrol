import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ProyectosClient from "./client";

export const dynamic = "force-dynamic";

export default async function TodosProyectosPage() {
  const proyectos = await prisma.proyecto.findMany({
    include: {
      constructora: { select: { id: true, nombre: true } },
      _count: { select: { edificios: true, admins_proyecto: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return (
    <>
      <Topbar
        title="Todos los proyectos"
        subtitle={`${proyectos.length} proyectos en el sistema`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ProyectosClient
          proyectos={proyectos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            estado: p.estado,
            constructora_id: p.constructora_id,
            constructora_nombre: p.constructora.nombre,
            edificios: p._count.edificios,
            adminsAsignados: p._count.admins_proyecto,
          }))}
        />
      </main>
    </>
  );
}
