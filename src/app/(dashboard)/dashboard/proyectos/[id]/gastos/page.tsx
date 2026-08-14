import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds, canAccessProject, isGeneralAdmin, isSuperAdmin } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSignedEvidenciaUrl } from "@/lib/storage";
import Topbar from "@/components/dashboard/Topbar";
import { ArrowLeft } from "lucide-react";
import GastosClient from "./client";
import type { GastoVista, AnticipoVista, OpcionEspacio, OpcionTarea } from "./client";

export const dynamic = "force-dynamic";

export default async function GastosProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { id } = await params;
  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (!canAccessProject(accessible, id)) redirect("/dashboard/proyectos");

  const proyecto = await prisma.proyecto.findFirst({
    where: { id, constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true, presupuesto_total: true },
  });
  if (!proyecto) notFound();

  // Espacios y tareas del proyecto (para los dropdowns y mano de obra).
  const espacios = await prisma.espacio.findMany({
    where: { unidad: { piso: { edificio: { proyecto_id: id } } } },
    select: {
      id: true,
      nombre: true,
      tareas: { select: { id: true, nombre: true, precio: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const opcionesEspacios: OpcionEspacio[] = espacios.map((e) => ({ id: e.id, nombre: e.nombre }));
  const opcionesTareas: OpcionTarea[] = espacios.flatMap((e) =>
    e.tareas.map((t) => ({ id: t.id, nombre: t.nombre, espacioNombre: e.nombre })),
  );

  // Mano de obra = suma de precios de TODAS las tareas del proyecto.
  const manoDeObra = espacios.reduce(
    (acc, e) => acc + e.tareas.reduce((s, t) => s + (t.precio ?? 0), 0),
    0,
  );

  const [gastos, anticipos] = await Promise.all([
    prisma.gasto.findMany({
      where: { proyecto_id: id },
      include: {
        espacio: { select: { id: true, nombre: true } },
        tarea: { select: { id: true, nombre: true } },
        registrador: { select: { id: true, nombre: true } },
        aprobador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: 500,
    }),
    prisma.anticipo.findMany({
      where: { proyecto_id: id },
      include: {
        receptor: { select: { id: true, nombre: true } },
        registrador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: 500,
    }),
  ]);

  // Resolver signed URLs de las facturas (los gastos guardan solo el path).
  const facturaUrls = await Promise.all(
    gastos.map((g) => (g.factura_url ? getSignedEvidenciaUrl(g.factura_url) : Promise.resolve(""))),
  );

  const gastosVista: GastoVista[] = gastos.map((g, i) => ({
    id: g.id,
    descripcion: g.descripcion,
    monto: g.monto,
    estado: g.estado,
    facturaUrl: facturaUrls[i] || null,
    fecha: g.fecha.toISOString(),
    espacioNombre: g.espacio?.nombre ?? null,
    tareaNombre: g.tarea?.nombre ?? null,
    registradoPor: g.registrador?.nombre ?? null,
    aprobadoPor: g.aprobador?.nombre ?? null,
    material: g.material,
    cantidad: g.cantidad,
    unidad: g.unidad,
    precioUnitario: g.precio_unitario,
  }));

  const anticiposVista: AnticipoVista[] = anticipos.map((a) => ({
    id: a.id,
    monto: a.monto,
    fecha: a.fecha.toISOString(),
    nota: a.nota,
    entregadoA: a.receptor?.nombre ?? null,
    registradoPor: a.registrador?.nombre ?? null,
  }));

  // Receptores posibles para anticipos: usuarios de la constructora.
  const receptores = await prisma.usuario.findMany({
    where: { constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const puedeAprobar =
    isGeneralAdmin(usuario.rol_ref.nivel_acceso) || isSuperAdmin(usuario.rol_ref.nivel_acceso);

  return (
    <>
      <Topbar title={`Gastos · ${proyecto.nombre}`} subtitle="¿En qué se va tu dinero?" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href={`/dashboard/proyectos/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al proyecto
        </Link>

        <GastosClient
          proyectoId={proyecto.id}
          presupuestoTotal={proyecto.presupuesto_total}
          manoDeObra={manoDeObra}
          puedeAprobar={puedeAprobar}
          gastos={gastosVista}
          anticipos={anticiposVista}
          espacios={opcionesEspacios}
          tareas={opcionesTareas}
          receptores={receptores}
        />
      </main>
    </>
  );
}
