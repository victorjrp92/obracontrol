import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Topbar from "@/components/dashboard/Topbar";
import { canAccessProject, getAccessibleProjectIds } from "@/lib/access";
import { getUsuarioActual } from "@/lib/data";
import { fechaEnColombia, hashCorto, momentoEnColombia } from "@/lib/documentos";
import { prisma } from "@/lib/prisma";
import { estadoCupo, perfilPuedeProductosTecnicos } from "@/lib/productos-tecnicos";
// Import DIRECTO, no por el barril: ver la nota en `productos-tecnicos/index.ts`.
import { puertosPrisma } from "@/lib/productos-tecnicos/puertos-prisma";
import { getSignedEvidenciaUrl } from "@/lib/storage";
import type { ProductoApi } from "@/components/productos-tecnicos/logica/api-productos-tecnicos";
import {
  listarEspacios,
  type ArbolInmueble,
} from "@/components/productos-tecnicos/logica/arbol-espacios";
import type { ActaEnPantalla } from "@/components/productos-tecnicos/logica/vista-acta-inicial";
import { separarPorMarca } from "@/components/productos-tecnicos/logica/vista-registro-inicial";
import RegistroInicialClient from "./client";

export const dynamic = "force-dynamic";

/**
 * Registro fotográfico inicial y acta de estado inicial de una obra.
 *
 * Mismas guardas que la pantalla de planos y renders, en el mismo orden: perfil
 * con la capacidad `productosTecnicos` (ARQUITECTO y CONSTRUCTORA), obra del
 * tenant, obra accesible para este usuario. La ruta API vuelve a comprobarlo
 * todo por su cuenta —una pantalla no autoriza nada—; el redirect de aquí es la
 * otra mitad: la navegación tampoco debe ofrecer algo que no se puede usar.
 */
export default async function RegistroInicialPage({
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

  const accesibles = await getAccessibleProjectIds(
    usuario.id,
    usuario.constructora_id,
    usuario.rol_ref.nivel_acceso,
  );
  if (!canAccessProject(accesibles, id)) redirect("/dashboard/proyectos");

  const proyecto = await prisma.proyecto.findFirst({
    where: { id, constructora_id: usuario.constructora_id },
    select: {
      id: true,
      nombre: true,
      matricula_inmobiliaria: true,
      direccion_inmueble: true,
    },
  });
  if (!proyecto) notFound();

  // El inmueble hasta el último nivel: el registro se organiza por ESPACIO, que
  // es donde de verdad se toma una foto. El árbol de planos y renders se queda
  // en la unidad y por eso no sirve aquí.
  const edificios = await prisma.edificio.findMany({
    where: { proyecto_id: id },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      pisos: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          unidades: {
            orderBy: { nombre: "asc" },
            select: {
              id: true,
              nombre: true,
              espacios: { orderBy: { nombre: "asc" }, select: { id: true, nombre: true } },
            },
          },
        },
      },
    },
  });
  const espacios = listarEspacios(edificios as ArbolInmueble);

  const filas = await prisma.productoTecnico.findMany({
    where: {
      proyecto_id: id,
      proyecto: { constructora_id: usuario.constructora_id },
      tipo: "REGISTRO_INICIAL",
      vigente: true,
    },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      proyecto_id: true,
      piso_id: true,
      unidad_id: true,
      tipo: true,
      nombre: true,
      descripcion: true,
      mime: true,
      bytes: true,
      version: true,
      vigente: true,
      reemplaza_a: true,
      subido_por_id: true,
      created_at: true,
      storage_path: true,
    },
  });

  // URLs firmadas temporales para la miniatura de cada foto. Se generan en el
  // servidor y de una vez: pedirlas desde el navegador una por una serían N
  // peticiones para pintar una cuadrícula.
  const urls = await Promise.all(filas.map((f) => getSignedEvidenciaUrl(f.storage_path)));

  const productos: ProductoApi[] = filas.map((fila) => ({
    id: fila.id,
    proyecto_id: fila.proyecto_id,
    piso_id: fila.piso_id,
    unidad_id: fila.unidad_id,
    tipo: fila.tipo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    mime: fila.mime,
    bytes: fila.bytes,
    version: fila.version,
    vigente: fila.vigente,
    reemplaza_a: fila.reemplaza_a,
    subido_por_id: fila.subido_por_id,
    created_at: fila.created_at.toISOString(),
  }));

  // Las dos mitades: lo que es registro y lo que se coló sin fecha ni ubicación.
  // Lo segundo NO se esconde — el acta se niega a emitirse mientras exista, así
  // que tiene que verse y poder descartarse desde la misma pantalla.
  const { fotos, sinMarca } = separarPorMarca(
    productos,
    espacios,
    new Map(filas.map((f, i) => [f.id, urls[i] || null])),
  );

  const documentos = await prisma.documentoFirmable.findMany({
    where: {
      proyecto_id: id,
      constructora_id: usuario.constructora_id,
      tipo: "ACTA_ESTADO_INICIAL",
    },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      folio: true,
      hash: true,
      version: true,
      created_at: true,
      firmado_el: true,
      matricula: true,
      recibido_el: true,
      // Basta con saber si hay alguna posterior: `take: 1` resuelve la pregunta
      // en la misma consulta, sin un `count` aparte por documento.
      siguientes: { select: { id: true }, take: 1 },
    },
  });

  const actas: ActaEnPantalla[] = documentos.map((d) => ({
    id: d.id,
    folio: d.folio,
    huellaCorta: hashCorto(d.hash),
    version: d.version,
    emitidaEl: fechaEnColombia(d.created_at),
    firmadoMomento: d.firmado_el ? momentoEnColombia(d.firmado_el) : null,
    matricula: d.matricula,
    recibidoMomento: d.recibido_el ? momentoEnColombia(d.recibido_el) : null,
    reemplazada: d.siguientes.length > 0,
  }));

  const usados = await puertosPrisma(usuario.constructora_id).bytesUsadosEnObra(id);

  // Se calcula aquí y se avisa antes de intentar emitir: la emisión se niega sin
  // matrícula inmobiliaria, y enterarse al pulsar el botón —después de recorrer
  // el inmueble tomando fotos— sería enterarse tarde.
  const faltanDatosInmueble =
    !proyecto.matricula_inmobiliaria?.trim() || !proyecto.direccion_inmueble?.trim();

  return (
    <>
      <Topbar
        title={`Registro inicial · ${proyecto.nombre}`}
        subtitle="Estado del inmueble antes de empezar la obra"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Link
          href={`/dashboard/proyectos/${id}/tecnicos`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a productos técnicos
        </Link>

        <RegistroInicialClient
          proyectoId={proyecto.id}
          espacios={espacios}
          fotosIniciales={fotos}
          fotosSinMarcaIniciales={sinMarca}
          actasIniciales={actas}
          cupoInicial={estadoCupo(usados)}
          faltanDatosInmueble={faltanDatosInmueble}
        />
      </main>
    </>
  );
}
