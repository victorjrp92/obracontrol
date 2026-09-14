import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { canApproveTasks, getAccessibleProjectIds } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Topbar from "@/components/dashboard/Topbar";
import BitacoraObra from "@/components/dashboard/BitacoraObra";
import { getBitacora } from "@/lib/data-bitacora";
import FiltrosBitacora from "./FiltrosBitacora";

// ---------------------------------------------------------------------------
// /dashboard/reportes/bitacora — quien hizo que, cuando, y quien lo aprobo o lo
// devolvio.
//
// La obra NO se toma del parametro tal cual: se busca dentro de las obras a las
// que este usuario tiene acceso (`getAccessibleProjectIds`) y si no aparece, se
// cae a la primera suya. Un admin de obra que cambie el id a mano en la barra
// de direcciones se queda en su propia obra, no en la del vecino.
// ---------------------------------------------------------------------------

interface Parametros {
  proyecto?: string;
  persona?: string;
  fase?: string;
  torre?: string;
  desde?: string;
  hasta?: string;
  pagina?: string;
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  // Esta pantalla es el expediente de decisiones de personas con nombre y
  // apellido. El layout del dashboard ya echa al contratista y al personal de
  // campo, pero no al obrero; la guarda va aqui y por capacidad (quien puede
  // aprobar) y no por lista de roles, para que un rol nuevo no entre gratis.
  if (!canApproveTasks(usuario.rol_ref.nivel_acceso)) redirect("/dashboard");

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );

  // Sin filtro de estado: la bitacora es historia, y la de una obra terminada
  // es justo la que se consulta cuando alguien reclama.
  const proyectos = await prisma.proyecto.findMany({
    where: {
      constructora_id: usuario.constructora_id,
      ...(accessible !== "ALL" ? { id: { in: accessible } } : {}),
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const params = await searchParams;
  const elegida = proyectos.find((p) => p.id === params.proyecto) ?? proyectos[0];

  if (!elegida) {
    return (
      <>
        <Cabecera />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <p className="text-sm text-slate-400">
              Todavia no tienes ninguna obra asignada, asi que no hay bitacora que mostrar.
            </p>
          </div>
        </main>
      </>
    );
  }

  const paginaPedida = Number.parseInt(params.pagina ?? "1", 10);
  const datos = await getBitacora(
    elegida.id,
    usuario.constructora_id,
    {
      persona: params.persona,
      fase: params.fase,
      torre: params.torre,
      desde: params.desde,
      hasta: params.hasta,
    },
    Number.isFinite(paginaPedida) ? paginaPedida : 1,
  );

  const valores = {
    proyecto: elegida.id,
    persona: params.persona ?? "",
    fase: params.fase ?? "",
    torre: params.torre ?? "",
    desde: params.desde ?? "",
    hasta: params.hasta ?? "",
  };

  return (
    <>
      <Cabecera />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href="/dashboard/reportes"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Reportes
        </Link>

        <FiltrosBitacora
          proyectos={proyectos}
          personas={datos.personas}
          fases={datos.fases}
          torres={datos.torres}
          valores={valores}
        />

        <BitacoraObra datos={datos} params={valores} />
      </main>
    </>
  );
}

function Cabecera() {
  return (
    <Topbar
      title="Bitacora de obra"
      subtitle="Quien hizo que, cuando, y quien lo aprobo o lo devolvio"
    />
  );
}
