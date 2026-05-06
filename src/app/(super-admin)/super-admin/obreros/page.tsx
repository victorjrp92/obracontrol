import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ObrerosRankingClient from "./client";

export const dynamic = "force-dynamic";

export default async function ObrerosGlobalPage() {
  const obreros = await prisma.obrero.findMany({
    include: {
      contratista: { select: { id: true, nombre: true } },
      constructora: { select: { id: true, nombre: true } },
      _count: { select: { evidencias: true } },
    },
    orderBy: [{ score_total: "desc" }, { evidencias_aprobadas: "desc" }],
  });

  return (
    <>
      <Topbar
        title="Ranking global de obreros"
        subtitle={`${obreros.length} obreros en todas las constructoras · ordenados por puntuación`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ObrerosRankingClient
          obreros={obreros.map((o) => ({
            id: o.id,
            nombre: o.nombre,
            cedula: o.cedula,
            telefono: o.telefono,
            especialidad: o.especialidad,
            eps: o.eps,
            arl: o.arl,
            anos_experiencia: o.anos_experiencia,
            activo: o.activo,
            fecha_expiracion: o.fecha_expiracion.toISOString(),
            contratista: o.contratista.nombre,
            constructora: o.constructora.nombre,
            score_total: o.score_total,
            score_calidad: o.score_calidad,
            score_velocidad: o.score_velocidad,
            score_cumplimiento: o.score_cumplimiento,
            evidencias_aprobadas: o.evidencias_aprobadas,
            evidencias_rechazadas: o.evidencias_rechazadas,
            tareas_completadas: o.tareas_completadas,
            evidencias_total: o._count.evidencias,
          }))}
        />
      </main>
    </>
  );
}
