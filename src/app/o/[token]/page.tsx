import { prisma } from "@/lib/prisma";
import { getObreroTareas } from "@/lib/data-obrero";
import TareaCard from "@/components/obrero/TareaCard";
import { ClipboardList } from "lucide-react";

export default async function ObreroTaskListPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Re-lookup obrero (layout already validated)
  const obrero = await prisma.obrero.findUnique({
    where: { token },
    select: { contratista_id: true, constructora_id: true },
  });

  if (!obrero) return null;

  const tareas = await getObreroTareas(
    obrero.contratista_id,
    obrero.constructora_id
  );

  // Group tasks into sections
  const porHacer = tareas.filter(
    (t) => t.estado === "PENDIENTE" || t.estado === "NO_APROBADA"
  );
  const enRevision = tareas.filter((t) => t.estado === "REPORTADA");
  const completadas = tareas.filter((t) => t.estado === "APROBADA");

  if (tareas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
        <h2 className="text-lg font-bold text-slate-700 mb-1">
          No tienes tareas asignadas
        </h2>
        <p className="text-sm text-slate-500">
          Cuando tu contratista te asigne tareas, apareceran aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Por hacer */}
      {porHacer.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            Por hacer ({porHacer.length})
          </h2>
          <div className="flex flex-col gap-3">
            {porHacer.map((t) => (
              <TareaCard key={t.id} token={token} {...t} />
            ))}
          </div>
        </section>
      )}

      {/* En revision */}
      {enRevision.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            En revision ({enRevision.length})
          </h2>
          <div className="flex flex-col gap-3">
            {enRevision.map((t) => (
              <TareaCard key={t.id} token={token} {...t} />
            ))}
          </div>
        </section>
      )}

      {/* Completadas */}
      {completadas.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-3">
            Completadas ({completadas.length})
          </h2>
          <div className="flex flex-col gap-3">
            {completadas.map((t) => (
              <TareaCard key={t.id} token={token} {...t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
