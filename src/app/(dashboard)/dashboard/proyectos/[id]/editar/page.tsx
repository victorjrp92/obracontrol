import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { isGeneralAdmin } from "@/lib/access";
import { esCuentaPersonal, tonoPerfil } from "@/lib/plan";
import { getProyectoForEdit } from "@/lib/data-edit";
import { obtenerTareasAprendidas } from "@/lib/learning";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "../../nuevo/wizard";
import IntentWizard from "@/app/(dashboard)/empezar/IntentWizard";
import { cargarObraParaEditar } from "@/app/(dashboard)/empezar/actions";

export default async function EditarProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (!isGeneralAdmin(usuario.rol_ref.nivel_acceso)) redirect("/dashboard/proyectos");

  const { id } = await params;

  // Cuentas personales (B2C): edición total reusando el wizard de intención.
  // `cargarObraParaEditar` devuelve null si la obra no es de esta constructora o
  // no es cuenta personal → en ese caso seguimos con el flujo B2B de abajo.
  if (esCuentaPersonal(usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA")) {
    const obra = await cargarObraParaEditar(id);
    if (!obra) notFound();
    const tono = tonoPerfil(usuario.constructora!.tipo_cuenta);
    return (
      <IntentWizard
        tipoCuenta={usuario.constructora!.tipo_cuenta}
        nombreUsuario={usuario.nombre}
        tituloInicial={tono.intencionTitulo}
        subtituloInicial={tono.intencionSubtitulo}
        modo="editar"
        initial={obra}
      />
    );
  }

  // Constructoras (B2B): wizard estructural completo (torres/pisos/distribución).
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
