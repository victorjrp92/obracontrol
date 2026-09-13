import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { esCuentaPersonal } from "@/lib/plan";
import { muestraEconomiaDeObra } from "@/lib/economia";
import { obtenerTareasAprendidas } from "@/lib/learning";
import Topbar from "@/components/dashboard/Topbar";
import WizardClient from "./wizard";

export default async function NuevoProyectoPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");
  if (usuario.rol_ref.nivel_acceso !== "ADMIN_GENERAL") redirect("/dashboard/proyectos");
  // Cuentas personales crean obra con el asistente simple, no el wizard de empresa.
  if (esCuentaPersonal(usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA")) redirect("/empezar");

  // Quien ve el dinero de la obra (precios por tarea) se decide aqui, en el
  // unico sitio del asistente que conoce el tipo de cuenta, y baja por props.
  // Hoy siempre es false -la linea de arriba manda a las cuentas personales al
  // asistente simple-, pero se pasa explicito para que el dia que el wizard se
  // abra a B2C no haya que ir a buscar donde estaba escondida la decision.
  const muestraEconomia = muestraEconomiaDeObra(usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA");

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
      <WizardClient contratistas={contratistas} tareasAprendidas={tareasAprendidas} muestraEconomia={muestraEconomia} />
    </>
  );
}
