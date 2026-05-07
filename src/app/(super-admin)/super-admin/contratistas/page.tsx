import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ContratistasClient from "./client";

export const dynamic = "force-dynamic";

export default async function ContratistasPage() {
  const [contratistas, constructoras] = await Promise.all([
    prisma.contratista.findMany({
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true,
            constructora: { select: { id: true, nombre: true } },
            tareas_asignadas: { select: { estado: true } },
          },
        },
      },
      orderBy: { score_total: "desc" },
    }),
    prisma.constructora.findMany({
      where: { nombre: { not: "Sistema Seiricon" } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const data = contratistas.map((c) => ({
    id: c.id,
    nombre: c.usuario.nombre,
    email: c.usuario.email,
    constructoraId: c.usuario.constructora.id,
    constructora: c.usuario.constructora.nombre,
    scoreTotal: c.score_total,
    scoreCumplimiento: c.score_cumplimiento,
    scoreCalidad: c.score_calidad,
    scoreVelocidad: c.score_velocidad_correccion,
    tareasAprobadas: c.usuario.tareas_asignadas.filter((t) => t.estado === "APROBADA").length,
    tareasPendientes: c.usuario.tareas_asignadas.filter((t) => t.estado !== "APROBADA").length,
  }));

  return (
    <>
      <Topbar title="Contratistas" subtitle="Todos los contratistas del sistema" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ContratistasClient contratistas={data} constructoras={constructoras} />
      </main>
    </>
  );
}
