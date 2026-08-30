import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { getUsuarioActual } from "@/lib/data";
import { getAccessibleProjectIds, canAccessProject } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { estadoCupo, perfilPuedeProductosTecnicos } from "@/lib/productos-tecnicos";
// Import DIRECTO, no por el barril: `consultas` y `puertos-prisma` arrastran
// `@/lib/prisma`, y sacarlos por el índice metía Prisma en el bundle de los
// componentes `"use client"` que importan una constante de ese mismo barril.
import { listarProductos } from "@/lib/productos-tecnicos/consultas";
import { puertosPrisma } from "@/lib/productos-tecnicos/puertos-prisma";
import Topbar from "@/components/dashboard/Topbar";
import { aProductoParaVista } from "@/components/productos-tecnicos/logica/mapear-producto";
import ProductosTecnicosClient from "./client";

export const dynamic = "force-dynamic";

/**
 * Planos, renders y su cupo — solo ARQUITECTO y CONSTRUCTORA
 * (`puede(tipo, "productosTecnicos")`, `src/lib/plan.ts`).
 *
 * La ruta API ya devuelve 403 a quien no tiene la capacidad; el redirect de
 * aquí es la otra mitad de esa regla: la navegación tampoco debe OFRECER una
 * pantalla que no se puede usar. Quien llegue igual por una URL a mano se
 * encuentra con su obra, no con un error — no hay nada que explicarle porque
 * no es una acción que haya intentado desde la app.
 */
export default async function ProductosTecnicosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.constructora_id) redirect("/login");

  const { id } = await params;

  const tipoCuenta = usuario.constructora?.tipo_cuenta ?? "CONSTRUCTORA";
  if (!perfilPuedeProductosTecnicos(tipoCuenta)) {
    redirect(`/dashboard/proyectos/${id}`);
  }

  const accessible = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (!canAccessProject(accessible, id)) redirect("/dashboard/proyectos");

  const proyecto = await prisma.proyecto.findFirst({
    where: { id, constructora_id: usuario.constructora_id },
    select: { id: true, nombre: true },
  });
  if (!proyecto) notFound();

  // Árbol de edificio → piso → unidad, para el selector de ubicación del
  // formulario de subida. Consulta propia y mínima (solo ids y nombres) —
  // no es del dominio de productos técnicos, es la estructura de la obra.
  const edificios = await prisma.edificio.findMany({
    where: { proyecto_id: id },
    select: {
      id: true,
      nombre: true,
      pisos: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          unidades: { select: { id: true, nombre: true }, orderBy: { nombre: "asc" } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  // TODAS las versiones (histórico incluido) de planos y renders — la vista
  // arma sus propias cadenas con `agruparPlanos`. El registro fotográfico
  // inicial no es de esta pantalla (leaf de planos y renders).
  const todosLosProductos = await listarProductos({
    constructoraId: usuario.constructora_id,
    proyectoId: id,
    incluirHistorico: true,
  });
  const productosDelModulo = todosLosProductos.filter((p) => p.tipo === "PLANO" || p.tipo === "RENDER");

  // Quién subió cada versión — `listarProductos` solo trae el id
  // (`CAMPOS_PUBLICOS` no hace el join; ver `src/lib/productos-tecnicos/consultas.ts`),
  // así que se resuelve en una consulta aparte, como hace `gastos/page.tsx`
  // con `registrador`/`aprobador`.
  const idsSubidores = [...new Set(productosDelModulo.map((p) => p.subido_por_id))];
  const nombresSubidores = idsSubidores.length
    ? await prisma.usuario.findMany({
        where: { id: { in: idsSubidores } },
        select: { id: true, nombre: true },
      })
    : [];
  const nombrePorId = new Map(nombresSubidores.map((u) => [u.id, u.nombre]));

  const productos = productosDelModulo.map((p) =>
    aProductoParaVista({ ...p, created_at: p.created_at.toISOString() }, { nombrePorId, edificios }),
  );

  const usados = await puertosPrisma(usuario.constructora_id).bytesUsadosEnObra(id);
  const cupo = estadoCupo(usados);

  return (
    <>
      <Topbar title={`Planos y renders · ${proyecto.nombre}`} subtitle="Productos técnicos de la obra" />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Link
            href={`/dashboard/proyectos/${id}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al proyecto
          </Link>
          {/* El registro fotográfico inicial es el tercer producto técnico de la
              obra y tiene pantalla propia: sus fotos se toman con la cámara, no
              se suben, así que no cabe en el diálogo de subida de esta. */}
          <Link
            href={`/dashboard/proyectos/${id}/tecnicos/registro-inicial`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Camera className="w-4 h-4" /> Registro inicial y acta
          </Link>
        </div>

        <ProductosTecnicosClient
          proyectoId={proyecto.id}
          edificios={edificios}
          cupoInicial={cupo}
          productosIniciales={productos}
          usuarioActualId={usuario.id}
          usuarioActualNombre={usuario.nombre}
        />
      </main>
    </>
  );
}
