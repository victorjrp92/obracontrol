import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import { ArrowLeft } from "lucide-react";
import ConstructoraDetalleClient from "./client";

export const dynamic = "force-dynamic";

export default async function ConstructoraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const constructora = await prisma.constructora.findUnique({
    where: { id },
    include: {
      proyectos: {
        select: {
          id: true,
          nombre: true,
          estado: true,
          _count: { select: { admins_proyecto: true } },
        },
      },
      usuarios: {
        include: {
          rol_ref: { select: { id: true, nombre: true, nivel_acceso: true } },
          proyectos_administrados: { select: { proyecto_id: true } },
        },
        orderBy: { created_at: "desc" },
      },
    },
  });

  if (!constructora) notFound();

  const usuariosMapped = constructora.usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol_ref.nombre,
    rol_nivel: u.rol_ref.nivel_acceso,
    proyectos_asignados: u.proyectos_administrados.length,
  }));

  return (
    <>
      <Topbar
        title={constructora.nombre}
        subtitle={`NIT ${constructora.nit ?? "—"} · ${constructora.ciudad ?? "Sin ciudad"}`}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href="/super-admin/constructoras"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a constructoras
        </Link>

        <ConstructoraDetalleClient
          constructora={{
            id: constructora.id,
            nombre: constructora.nombre,
            nit: constructora.nit ?? "",
            ciudad: constructora.ciudad ?? "",
            direccion: constructora.direccion ?? "",
            telefono: constructora.telefono ?? "",
            sitio_web: constructora.sitio_web ?? "",
            plan_suscripcion: constructora.plan_suscripcion,
          }}
          proyectos={constructora.proyectos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            estado: p.estado,
            adminsAsignados: p._count.admins_proyecto,
          }))}
          usuarios={usuariosMapped}
        />
      </main>
    </>
  );
}
