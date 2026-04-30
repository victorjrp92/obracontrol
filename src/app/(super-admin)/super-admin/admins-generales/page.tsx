import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import AdminsGeneralesClient from "./client";

export const dynamic = "force-dynamic";

export default async function AdminsGeneralesPage({
  searchParams,
}: {
  searchParams: Promise<{ constructora?: string }>;
}) {
  const { constructora: preselectId } = await searchParams;

  const [admins, constructoras] = await Promise.all([
    prisma.usuario.findMany({
      where: { rol_ref: { nivel_acceso: "ADMIN_GENERAL" } },
      include: {
        constructora: { select: { id: true, nombre: true } },
        rol_ref: { select: { nombre: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.constructora.findMany({
      where: { nombre: { not: "Sistema Seiricon" } },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <>
      <Topbar title="Admin Generales" subtitle="Crear y asignar dueños de constructora" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <AdminsGeneralesClient
          admins={admins.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            email: a.email,
            constructora: a.constructora?.nombre ?? "—",
            constructora_id: a.constructora_id,
          }))}
          constructoras={constructoras}
          preselectConstructoraId={preselectId ?? ""}
        />
      </main>
    </>
  );
}
