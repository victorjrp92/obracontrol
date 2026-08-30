import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/tenant";
import { eliminarObjeto, subirProductoTecnico, sufijoUnico } from "@/lib/productos-tecnicos/almacenamiento";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { CAMPOS_PUBLICOS } from "@/lib/productos-tecnicos/consultas";
import { BYTES_CABECERA } from "@/lib/productos-tecnicos/formatos";
import { puertosPrisma } from "@/lib/productos-tecnicos/puertos-prisma";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import { rutaProductoTecnico } from "@/lib/productos-tecnicos/ruta";
import { prepararSubida } from "@/lib/productos-tecnicos/subida";
import {
  construirMarca,
  serializarMarca,
  NOTA_LARGO_MAX,
} from "@/components/productos-tecnicos/logica/marca-foto-inicial";

/**
 * POST /api/productos-tecnicos/acta/foto — una foto del registro inicial.
 *
 * ES LA ÚNICA PUERTA DEL REGISTRO INICIAL, y por eso pide cosas que la ruta
 * genérica de productos técnicos no pide: en qué espacio del inmueble se tomó,
 * en qué instante, y en qué coordenadas. Sin esos tres datos no se escribe la
 * fila. Una foto de galería no los tiene —no tiene instante propio ni
 * ubicación— y quien quisiera inventárselos chocaría con la comprobación de
 * abajo: el instante declarado tiene que caer junto al del reloj del SERVIDOR,
 * que es el que además queda escrito en `created_at`.
 *
 * Del lado del navegador la puerta se cierra antes: la pantalla del registro no
 * tiene ningún `<input type="file">`. Los píxeles salen de un `MediaStream` de
 * `getUserMedia` dibujado en un `canvas`, así que no existe el gesto de escoger
 * un archivo. Ver `src/components/productos-tecnicos/CamaraRegistroInicial.tsx`.
 *
 * Aislamiento: `requireUser()` → `contextoProductosTecnicos()` (403 si el perfil
 * no tiene el módulo) → `assertObraAccesible()` (404 de otro tenant, 403 si la
 * obra no es de este usuario) → el espacio se busca colgando de ESA obra.
 */

/**
 * Cuánto puede separarse el instante declarado del reloj del servidor.
 *
 * Quince minutos, no una hora: la foto se sube en cuanto se toma, y el margen
 * está para una subida con mala señal, no para dar cabida a una foto de ayer.
 * Hacia el futuro el margen es mucho más corto —dos minutos— porque una foto
 * tomada «dentro de media hora» no es una desincronización de reloj, es una
 * fecha inventada.
 */
const MARGEN_PASADO_MS = 15 * 60 * 1000;
const MARGEN_FUTURO_MS = 2 * 60 * 1000;

function texto(valor: FormDataEntryValue | null): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

function numero(valor: FormDataEntryValue | null): number | null {
  const crudo = texto(valor);
  if (crudo === null) return null;
  const n = Number(crudo);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const form = await req.formData();

    const archivo = form.get("file");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No llegó la imagen capturada." }, { status: 400 });
    }

    const proyectoId = texto(form.get("proyecto_id"));
    if (!proyectoId) {
      return NextResponse.json({ error: "proyecto_id es requerido" }, { status: 400 });
    }
    // Aislamiento de la obra ANTES de leer un solo byte de la imagen.
    await assertObraAccesible(ctx, proyectoId);

    const espacioId = texto(form.get("espacio_id"));
    if (!espacioId) {
      return NextResponse.json(
        { error: "Di en qué espacio del inmueble se tomó la foto." },
        { status: 400 },
      );
    }

    // El espacio tiene que colgar de ESTA obra y de este tenant. Se resuelve de
    // una vez la unidad a la que pertenece: es la que se guarda en la fila, y
    // sacarla de aquí evita que el cliente pueda declarar una distinta.
    const espacio = await prisma.espacio.findFirst({
      where: {
        id: espacioId,
        unidad: {
          piso: {
            edificio: { proyecto: { id: proyectoId, constructora_id: ctx.constructoraId } },
          },
        },
      },
      select: { id: true, nombre: true, unidad_id: true },
    });
    if (!espacio) {
      return NextResponse.json(
        { error: "Ese espacio no existe en esta obra." },
        { status: 404 },
      );
    }

    const capturadaEnCrudo = texto(form.get("capturada_en"));
    const instante = capturadaEnCrudo ? Date.parse(capturadaEnCrudo) : NaN;
    if (Number.isNaN(instante)) {
      return NextResponse.json(
        { error: "La foto tiene que traer el instante en que se tomó." },
        { status: 400 },
      );
    }
    const ahora = Date.now();
    if (instante < ahora - MARGEN_PASADO_MS || instante > ahora + MARGEN_FUTURO_MS) {
      return NextResponse.json(
        {
          error:
            "La hora de la foto no coincide con la de este momento. El registro inicial solo admite " +
            "fotos tomadas ahora mismo desde la app: vuelve a tomarla.",
        },
        { status: 400 },
      );
    }

    const lat = numero(form.get("lat"));
    const lng = numero(form.get("lng"));
    if (lat === null || lng === null) {
      return NextResponse.json(
        {
          error:
            "La foto tiene que traer la ubicación del momento de la captura. Permite el acceso a la " +
            "ubicación y vuelve a tomarla.",
        },
        { status: 400 },
      );
    }

    const notaCruda = texto(form.get("nota"));
    if (notaCruda && notaCruda.length > NOTA_LARGO_MAX) {
      return NextResponse.json(
        { error: `La observación no puede pasar de ${NOTA_LARGO_MAX} caracteres.` },
        { status: 400 },
      );
    }

    // La marca se construye en el SERVIDOR con los datos ya validados. Si algo
    // no cuadra, lanza aquí y no se sube nada.
    let marca: string;
    try {
      marca = serializarMarca(
        construirMarca({
          espacioId: espacio.id,
          espacio: espacio.nombre,
          unidadId: espacio.unidad_id,
          capturadaEn: new Date(instante),
          gps: { lat, lng },
          nota: notaCruda,
        }),
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "La foto llegó incompleta." },
        { status: 400 },
      );
    }

    const cabecera = new Uint8Array(await archivo.slice(0, BYTES_CABECERA).arrayBuffer());

    // El dominio decide: perfil, formato real por magic number (el registro
    // inicial solo admite imagen), cupo de la obra y pertenencia de la unidad.
    const plan = await prepararSubida(
      {
        ubicacion: { proyectoId, pisoId: null, unidadId: espacio.unidad_id },
        tipo: "REGISTRO_INICIAL",
        nombre: espacio.nombre,
        descripcion: marca,
        archivo: {
          nombre: archivo.name,
          mimeDeclarado: archivo.type,
          bytes: archivo.size,
          cabecera,
        },
        reemplazaA: null,
      },
      puertosPrisma(ctx.constructoraId),
      ctx.tipoCuenta,
    );

    const storagePath = rutaProductoTecnico({
      proyectoId,
      tipo: plan.tipo,
      extension: plan.extension,
      sufijoUnico: sufijoUnico(),
    });

    await subirProductoTecnico(archivo, storagePath, plan.mime);

    try {
      const producto = await prisma.productoTecnico.create({
        data: {
          proyecto_id: plan.ubicacion.proyectoId,
          piso_id: null,
          unidad_id: plan.ubicacion.unidadId ?? null,
          tipo: plan.tipo,
          nombre: plan.nombre,
          descripcion: plan.descripcion,
          storage_path: storagePath,
          mime: plan.mime,
          bytes: plan.bytes,
          version: plan.version,
          vigente: true,
          reemplaza_a: null,
          subido_por_id: ctx.usuarioId,
        },
        select: CAMPOS_PUBLICOS,
      });

      return NextResponse.json({ producto, cupo: plan.cupo }, { status: 201 });
    } catch (error) {
      // Si la base no aceptó la fila, el objeto subido es basura que seguiría
      // pesando contra el cupo real del bucket sin figurar en ninguna consulta.
      await eliminarObjeto(storagePath).catch(() => {});
      throw error;
    }
  } catch (error) {
    return respuestaDeError(error, "POST /api/productos-tecnicos/acta/foto");
  }
}
