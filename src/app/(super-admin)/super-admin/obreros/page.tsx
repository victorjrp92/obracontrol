import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import ObrerosClient from "./client";

export const dynamic = "force-dynamic";

export default async function ObrerosPage() {
  const [obreros, constructoras] = await Promise.all([
    prisma.obrero.findMany({
      include: {
        constructora: { select: { id: true, nombre: true } },
        contratista: { select: { nombre: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.constructora.findMany({
      where: { nombre: { not: "Sistema Seiricon" } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const data = obreros.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    cedula: o.cedula,
    especialidad: o.especialidad,
    activo: o.activo,
    scoreTotal: o.score_total,
    contratista: o.contratista.nombre,
    constructoraId: o.constructora.id,
    constructora: o.constructora.nombre,
  }));

  return (
    <>
      <Topbar title="Personal de campo" subtitle="Todo el personal de campo del sistema" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <ObrerosClient obreros={data} constructoras={constructoras} />
      </main>
    </>
  );
}
