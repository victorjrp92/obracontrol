import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { isGeneralAdmin } from "@/lib/access";
import { getProyectoForEdit } from "@/lib/data-edit";
import { obtenerTareasAprendidas } from "@/lib/learning";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "../../nuevo/wizard";

export default async function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!isGeneralAdmin(usuario.rol_ref.nivel_acceso)) redirect("/dashboard/proyectos");

  const { id } = await params;

  const [editData, contratistas, tareasAprendidas] = await Promise.all([
    getProyectoForEdit(id, usuario.constructora_id),
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

  if (!editData) notFound();

  return (
    <>
      <Topbar title="Editar proyecto" subtitle={editData.nombre} />
      <WizardClient contratistas={contratistas} initialData={editData} tareasAprendidas={tareasAprendidas} />
    </>
  );
}
