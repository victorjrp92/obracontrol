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

  const [contratistas, tareasAprendidas, asignadosRecientes] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        constructora_id: usuario.constructora_id,
        rol_ref: { nivel_acceso: "CONTRATISTA" },
      },
      select: { id: true, nombre: true, rol_ref: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    obtenerTareasAprendidas(usuario.constructora_id),
    // Contratistas «habituales»: los que tuvieron tareas asignadas en los
    // ultimos 5 proyectos de ESTA constructora. Solo alimentan la
    // preseleccion del paso 1 del wizard — preseleccionar no asigna nada.
    (async () => {
      const ultimos = await prisma.proyecto.findMany({
        where: { constructora_id: usuario.constructora_id },
        orderBy: { created_at: "desc" },
        take: 5,
        select: { id: true },
      });
      if (ultimos.length === 0) return [] as string[];
      const filas = await prisma.tarea.findMany({
        where: {
          asignado_a: { not: null },
          espacio: {
            unidad: {
              piso: {
                edificio: {
                  proyecto: {
                    id: { in: ultimos.map((p) => p.id) },
                    // Redundante con el `in` (esos ids ya salieron filtrados
                    // por tenant), pero la regla del repo es que TODA query de
                    // Tarea atraviese el filtro de constructora explicito.
                    constructora_id: usuario.constructora_id,
                  },
                },
              },
            },
          },
        },
        select: { asignado_a: true },
        distinct: ["asignado_a"],
      });
      return filas.map((f) => f.asignado_a).filter((v): v is string => v !== null);
    })(),
  ]);

  // Interseccion con los contratistas activos: alguien asignado en obras
  // viejas que ya no tiene rol CONTRATISTA no puede preseleccionarse. El
  // orden final es el de la lista de contratistas (alfabetico), para que el
  // «primero» que autocompleta el default sea predecible.
  const idsRecientes = new Set(asignadosRecientes);
  const contratistasHabituales = contratistas.filter((c) => idsRecientes.has(c.id)).map((c) => c.id);

  return (
    <>
      <Topbar title="Nuevo proyecto" subtitle="Configura tu proyecto paso a paso" />
      <WizardClient
        usuarioId={usuario.id}
        contratistas={contratistas}
        contratistasHabituales={contratistasHabituales}
        tareasAprendidas={tareasAprendidas}
        muestraEconomia={muestraEconomia}
      />
    </>
  );
}
