import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds } from "@/lib/access";
import Topbar from "@/components/dashboard/Topbar";
import SugerenciasPanel from "@/components/dashboard/SugerenciasPanel";

export default async function SugerenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  if (!["ADMIN_GENERAL", "ADMIN_PROYECTO", "DIRECTIVO"].includes(usuario.rol_ref.nivel_acceso)) {
    redirect("/dashboard");
  }

  const accessible = await getAccessibleProjectIds(usuario.id, usuario.constructora_id, usuario.rol_ref.nivel_acceso);

  const { estado } = await searchParams;
  const estadoActivo = estado ?? "PENDIENTE";

  // Fetch all suggestions for this constructora
  const sugerenciasRaw = await prisma.tareaSugerida.findMany({
    where: {
      proyecto: {
        constructora_id: usuario.constructora_id,
        ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
      },
    },
    include: {
      contratista: { select: { id: true, nombre: true, email: true } },
      proyecto: { select: { id: true, nombre: true } },
      revisor: { select: { id: true, nombre: true } },
    },
    orderBy: { created_at: "desc" },
  });

  // Get unique project IDs from all suggestions
  const proyectoIds = [...new Set(sugerenciasRaw.map((s) => s.proyecto_id))];

  // Fetch fases for each project
  const fasesRaw = await prisma.fase.findMany({
    where: { proyecto_id: { in: proyectoIds } },
    select: { id: true, nombre: true, proyecto_id: true },
    orderBy: { orden: "asc" },
  });

  // Build fasesMap keyed by proyecto_id
  const fasesMap: Record<string, { id: string; nombre: string }[]> = {};
  for (const f of fasesRaw) {
    if (!fasesMap[f.proyecto_id]) fasesMap[f.proyecto_id] = [];
    fasesMap[f.proyecto_id].push({ id: f.id, nombre: f.nombre });
  }

  // Serialize sugerencias (ensure unidades is string[])
  const sugerencias = sugerenciasRaw.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    foto_url: s.foto_url,
    estado: s.estado as "PENDIENTE" | "APROBADA" | "RECHAZADA",
    motivo_rechazo: s.motivo_rechazo,
    unidades: Array.isArray(s.unidades) ? (s.unidades as string[]) : [],
    created_at: s.created_at.toISOString(),
    contratista: s.contratista,
    proyecto: s.proyecto,
    revisor: s.revisor,
  }));

  const pendingCount = sugerencias.filter((s) => s.estado === "PENDIENTE").length;

  return (
    <>
      <Topbar
        title="Sugerencias de tareas"
        subtitle={pendingCount > 0 ? `${pendingCount} pendiente${pendingCount !== 1 ? "s" : ""} de revisión` : "Sin sugerencias pendientes"}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <SugerenciasPanel
          sugerencias={sugerencias}
          fasesMap={fasesMap}
          initialTab={estadoActivo}
        />
      </main>
    </>
  );
}
