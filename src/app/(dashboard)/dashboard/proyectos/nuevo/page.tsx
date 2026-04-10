import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "./wizard";

export default async function NuevoProyectoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!["ADMIN", "JEFE_OPERACIONES"].includes(usuario.rol)) redirect("/dashboard/proyectos");

  const contratistas = await prisma.usuario.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      rol: { in: ["CONTRATISTA_INSTALADOR", "CONTRATISTA_LUSTRADOR"] },
    },
    select: { id: true, nombre: true, rol: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <Topbar title="Nuevo proyecto" subtitle="Configura tu proyecto paso a paso" />
      <WizardClient contratistas={contratistas} />
    </>
  );
}
