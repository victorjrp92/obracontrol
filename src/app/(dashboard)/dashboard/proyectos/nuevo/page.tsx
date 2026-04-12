import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "./wizard";

export default async function NuevoProyectoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!["ADMINISTRADOR"].includes(usuario.rol_ref.nivel_acceso)) redirect("/dashboard/proyectos");

  const contratistas = await prisma.usuario.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      rol_ref: { nivel_acceso: "CONTRATISTA" },
    },
    select: { id: true, nombre: true, rol_ref: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <Topbar title="Nuevo proyecto" subtitle="Configura tu proyecto paso a paso" />
      <WizardClient contratistas={contratistas} />
    </>
  );
}
