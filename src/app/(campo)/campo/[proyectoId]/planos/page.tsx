import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getProductosDeObraCampo } from "@/lib/data-campo";
import { perfilPuedeProductosTecnicos } from "@/lib/productos-tecnicos/acceso";
import Topbar from "@/components/dashboard/Topbar";
import { etiquetaDeUbicacion } from "@/components/productos-tecnicos/logica/ubicaciones";
import ListaProductosCampo, { type ProductoCampoItem } from "./ListaProductosCampo";

export const dynamic = "force-dynamic";

/**
 * Planos y renders de una obra asignada — SOLO LECTURA.
 *
 * ══ POR QUÉ ESTA PANTALLA Y NO UN ENLACE A LA QUE YA EXISTE ════════════════
 *
 * La pantalla del módulo es `/dashboard/proyectos/[id]/tecnicos`, y mandar
 * aquí al personal de campo tenía dos problemas:
 *
 *   1. Vive dentro del grupo `(dashboard)`, que es la zona de administración a
 *      la que este rol no debe entrar (y de la que el layout de `(dashboard)`
 *      tiene pendiente echarlo). Un enlace a una zona de la que te van a
 *      rebotar es un enlace roto.
 *   2. Trae el diálogo de subida, el reemplazo de versiones y el cambio de
 *      cuál es la vigente. Este rol construye con el plano, no lo emite.
 *
 * Lo que sí se reutiliza es todo lo que hay debajo: la consulta
 * (`listarProductos`), la etiqueta de ubicación (`etiquetaDeUbicacion`) y la
 * ruta de descarga firmada. Aquí no se duplica ni una regla del módulo.
 *
 * Solo se enseña la VERSIÓN VIGENTE de cada archivo. El histórico existe para
 * quien lo emite; para quien construye, dos versiones del mismo plano en la
 * misma lista es la forma de que alguien levante un muro con la equivocada.
 */
export default async function PlanosCampoPage({
  params,
}: {
  // Next 16: los params de ruta son Promise.
  params: Promise<{ proyectoId: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { proyectoId } = await params;

  // Los productos técnicos se cierran por TIPO DE CUENTA, no por nivel de
  // acceso (`src/lib/productos-tecnicos/acceso.ts` → `puede(tipo, …)` de
  // plan.ts). Mismo criterio que la pantalla del dashboard: quien llega por
  // una URL a mano vuelve a su obra, no se encuentra un error de algo que no
  // intentó hacer.
  const tipoCuenta = usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA";
  if (!perfilPuedeProductosTecnicos(tipoCuenta)) {
    redirect(`/campo/${proyectoId}`);
  }

  const datos = await getProductosDeObraCampo(
    {
      usuarioId: usuario.id,
      constructoraId: usuario.constructora_id,
      nivelAcceso: usuario.rol_ref.nivel_acceso,
    },
    proyectoId,
  );
  if (!datos) notFound();

  const items: (ProductoCampoItem & { tipo: string })[] = datos.productos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    version: p.version,
    fecha: p.created_at,
    bytes: p.bytes,
    subidoPor: datos.nombrePorId.get(p.subido_por_id) ?? null,
    ubicacion: etiquetaDeUbicacion(datos.edificios, p.piso_id, p.unidad_id),
    tipo: p.tipo,
  }));

  const planos = items.filter((i) => i.tipo === "PLANO");
  const renders = items.filter((i) => i.tipo === "RENDER");

  return (
    <>
      <Topbar title={`Planos y renders · ${datos.proyecto.nombre}`} subtitle="Solo lectura" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href={`/campo/${datos.proyecto.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a la obra
        </Link>

        <p className="text-xs text-slate-500 mb-4">
          Estás viendo la versión vigente de cada archivo. Si crees que hay una más nueva, pídesela
          a quien administra la obra.
        </p>

        <div className="flex flex-col gap-5">
          <ListaProductosCampo
            titulo="Planos"
            vacio="Esta obra todavía no tiene planos cargados."
            items={planos}
          />
          <ListaProductosCampo
            titulo="Renders"
            vacio="Esta obra todavía no tiene renders cargados."
            items={renders}
          />
        </div>
      </main>
    </>
  );
}
