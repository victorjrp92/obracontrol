import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ObrerosRankingClient from "./client";

export const dynamic = "force-dynamic";

export default async function ObrerosRankingPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const nivel = usuario.rol_ref.nivel_acceso;
  if (!["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(nivel)) {
    redirect("/dashboard");
  }

  const obreros = await prisma.obrero.findMany({
    where: { constructora_id: usuario.constructora_id },
    include: {
      contratista: { select: { id: true, nombre: true } },
      _count: { select: { evidencias: true } },
    },
    orderBy: [
      { score_total: "desc" },
      { evidencias_aprobadas: "desc" },
    ],
  });

  return (
    <>
      <Topbar
        title="Ranking de obreros"
        subtitle={`${obreros.length} obreros · ordenados por puntuación`}
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
