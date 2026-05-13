import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { obtenerTareasAprendidas } from "@/lib/learning";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "./wizard";

export default async function NuevoProyectoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") redirect("/dashboard/proyectos");

  const [contratistas, tareasAprendidas] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        constructora_id: usuario.constructora_id,
        rol_ref: { nivel_acceso: "CONTRATISTA" },
      },
      select: { id: true, nombre: true, rol_ref: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    obtenerTareasAprendidas(usuario.constructora_id),
  ]);

  return (
    <>
      <Topbar title="Nuevo proyecto" subtitle="Configura tu proyecto paso a paso" />
      <WizardClient contratistas={contratistas} tareasAprendidas={tareasAprendidas} />
    </>
  );
}
