import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import RolesClient from "./client";

export const dynamic = "force-dynamic";

export default async function RolesGlobalPage() {
  const roles = await prisma.rol.findMany({
    include: {
      constructora: { select: { id: true, nombre: true } },
      _count: { select: { usuarios: true } },
    },
    orderBy: [{ constructora: { nombre: "asc" } }, { nombre: "asc" }],
  });

  // Agrupar por constructora
  const grouped = new Map<string, { constructora_id: string; constructora_nombre: string; roles: typeof roles }>();
  for (const r of roles) {
    const key = r.constructora_id;
    const entry = grouped.get(key);
    if (entry) entry.roles.push(r);
    else
      grouped.set(key, {
        constructora_id: r.constructora_id,
        constructora_nombre: r.constructora.nombre,
        roles: [r],
      });
  }

  return (
    <>
      <Topbar
        title="Roles del sistema"
        subtitle={`${roles.length} roles distribuidos en ${grouped.size} constructoras`}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <RolesClient
          grupos={Array.from(grouped.values()).map((g) => ({
            constructora_id: g.constructora_id,
            constructora_nombre: g.constructora_nombre,
            roles: g.roles.map((r) => ({
              id: r.id,
              nombre: r.nombre,
              nivel_acceso: r.nivel_acceso,
              es_default: r.es_default,
              usuarios: r._count.usuarios,
            })),
          }))}
        />
      </main>
    </>
  );
}
