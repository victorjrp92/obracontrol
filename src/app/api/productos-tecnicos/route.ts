import { NextRequest, NextResponse } from "next/server";
import type { TipoProductoTecnico } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/tenant";
import { eliminarObjeto, subirProductoTecnico, sufijoUnico } from "@/lib/productos-tecnicos/almacenamiento";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { CAMPOS_PUBLICOS, listarProductos } from "@/lib/productos-tecnicos/consultas";
import { estadoCupo } from "@/lib/productos-tecnicos/cupo";
import { BYTES_CABECERA } from "@/lib/productos-tecnicos/formatos";
import { puertosPrisma } from "@/lib/productos-tecnicos/puertos-prisma";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import { rutaProductoTecnico } from "@/lib/productos-tecnicos/ruta";
import { prepararSubida } from "@/lib/productos-tecnicos/subida";

const TIPOS: readonly TipoProductoTecnico[] = ["REGISTRO_INICIAL", "PLANO", "RENDER"];

function tipoValido(valor: string | null): TipoProductoTecnico | null {
  if (!valor) return null;
  return TIPOS.includes(valor as TipoProductoTecnico) ? (valor as TipoProductoTecnico) : null;
}

function texto(valor: FormDataEntryValue | null): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

/**
 * GET /api/productos-tecnicos?proyecto_id=…[&tipo=…][&piso_id=…][&unidad_id=…][&historico=1]
 *
 * Devuelve los productos de una obra y cómo va su cupo. Por defecto solo las
 * versiones vigentes: quien está buscando el plano con el que se construye no
 * quiere ver seis versiones y tener que adivinar. El histórico se pide aparte.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const query = new URL(req.url).searchParams;
    const proyectoId = query.get("proyecto_id")?.trim();
    if (!proyectoId) {
      return NextResponse.json({ error: "proyecto_id es requerido" }, { status: 400 });
    }

    await assertObraAccesible(ctx, proyectoId);

    const tipoCrudo = query.get("tipo");
    if (tipoCrudo && !tipoValido(tipoCrudo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const productos = await listarProductos({
      constructoraId: ctx.constructoraId,
      proyectoId,
      tipo: tipoValido(tipoCrudo),
      pisoId: query.get("piso_id")?.trim() || null,
      unidadId: query.get("unidad_id")?.trim() || null,
      incluirHistorico: query.get("historico") === "1",
    });

    const usados = await puertosPrisma(ctx.constructoraId).bytesUsadosEnObra(proyectoId);

    return NextResponse.json({ productos, cupo: estadoCupo(usados) });
  } catch (error) {
    return respuestaDeError(error, "GET /api/productos-tecnicos");
  }
}

/**
 * POST /api/productos-tecnicos — multipart/form-data
 * Campos: file, proyecto_id, tipo, nombre, [descripcion], [piso_id | unidad_id],
 *         [reemplaza_a]
 *
 * El archivo pasa POR EL SERVIDOR a propósito, en vez de subirse directo a
 * Storage con una URL firmada: la validación por magic number necesita que
 * alguien de confianza vea los primeros bytes ANTES de que el archivo exista
 * en el bucket. Con subida directa, el cliente decide qué queda guardado y el
 * servidor solo se entera después.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const form = await req.formData();
    const archivo = form.get("file");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "file es requerido" }, { status: 400 });
    }

    const proyectoId = texto(form.get("proyecto_id"));
    if (!proyectoId) {
      return NextResponse.json({ error: "proyecto_id es requerido" }, { status: 400 });
    }

    // Aislamiento de la obra ANTES de leer un solo byte del archivo.
    await assertObraAccesible(ctx, proyectoId);

    const tipo = tipoValido(texto(form.get("tipo")));
    if (!tipo) {
      return NextResponse.json(
        { error: "tipo debe ser REGISTRO_INICIAL, PLANO o RENDER" },
        { status: 400 },
      );
    }

    const cabecera = new Uint8Array(await archivo.slice(0, BYTES_CABECERA).arrayBuffer());

    const plan = await prepararSubida(
      {
        ubicacion: {
          proyectoId,
          pisoId: texto(form.get("piso_id")),
          unidadId: texto(form.get("unidad_id")),
        },
        tipo,
        nombre: texto(form.get("nombre")) ?? "",
        descripcion: texto(form.get("descripcion")),
        archivo: {
          nombre: archivo.name,
          mimeDeclarado: archivo.type,
          bytes: archivo.size,
          cabecera,
        },
        reemplazaA: texto(form.get("reemplaza_a")),
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
      // Desactivar la anterior y crear la nueva van JUNTAS: por separado hay
      // un instante con cero versiones vigentes (o con dos, si falla la
      // segunda), y ese instante es exactamente el que rompe la garantía.
      const producto = await prisma.$transaction(async (tx) => {
        if (plan.aDesactivar.length > 0) {
          await tx.productoTecnico.updateMany({
            where: {
              id: { in: plan.aDesactivar },
              proyecto: { constructora_id: ctx.constructoraId },
            },
            data: { vigente: false },
          });
        }

        return tx.productoTecnico.create({
          data: {
            proyecto_id: plan.ubicacion.proyectoId,
            piso_id: plan.ubicacion.pisoId ?? null,
            unidad_id: plan.ubicacion.unidadId ?? null,
            tipo: plan.tipo,
            nombre: plan.nombre,
            descripcion: plan.descripcion,
            storage_path: storagePath,
            mime: plan.mime,
            bytes: plan.bytes,
            version: plan.version,
            vigente: true,
            reemplaza_a: plan.reemplazaA,
            subido_por_id: ctx.usuarioId,
          },
          select: CAMPOS_PUBLICOS,
        });
      });

      return NextResponse.json({ producto, cupo: plan.cupo }, { status: 201 });
    } catch (error) {
      // Si la base no aceptó la fila, el objeto en Storage es basura que
      // seguiría contando contra el cupo real del bucket sin figurar en
      // ninguna consulta. Se limpia; si el borrado falla, no se tapa el error
      // original con el del borrado.
      await eliminarObjeto(storagePath).catch(() => {});
      throw error;
    }
  } catch (error) {
    return respuestaDeError(error, "POST /api/productos-tecnicos");
  }
}
