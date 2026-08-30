import { NextRequest, NextResponse } from "next/server";
import { checkAdminProjectPermission } from "@/lib/access";
import {
  almacenPerfilFirma,
  almacenPrisma,
  emitirCorreccion,
  emitirDocumento,
  fechaEnColombia,
  hashCorto,
} from "@/lib/documentos";
import type { DatosInmueble } from "@/lib/inmueble";
import { prisma } from "@/lib/prisma";
import { assertObraAccesible, contextoProductosTecnicos } from "@/lib/productos-tecnicos/contexto";
import { respuestaDeError } from "@/lib/productos-tecnicos/respuesta";
import { requireUser } from "@/lib/tenant";
import type { TipoPropiedad } from "@/lib/plantillas-personal";
import {
  construirPayloadActa,
  esActaInicialError,
  serializarContenidoActa,
  type FotoRegistroFila,
} from "@/components/productos-tecnicos/logica/acta-estado-inicial";
import type { ArbolInmueble } from "@/components/productos-tecnicos/logica/arbol-espacios";
import { guardarSnapshotActa } from "./_almacen-acta";

/**
 * POST /api/productos-tecnicos/acta — emite el acta de estado inicial de una
 * obra, o la corrección de una anterior.
 *
 * CÓMO SE EMITE, y por qué así:
 *
 *  1. Se arma el contenido con `construirPayloadActa()`, que se niega a
 *     producir un acta sin matrícula inmobiliaria, sin fotos, o con una sola
 *     foto que no lleve fecha, hora y ubicación quemadas.
 *  2. Se emite con `emitirDocumento()` —nunca escribiendo la fila a mano—, que
 *     genera folio `AE-…` y la huella SHA-256 del contenido serializado.
 *  3. Se congela ese contenido, byte por byte, en Storage. El PDF se imprime
 *     SIEMPRE desde esa copia, así que corregir después la dirección del
 *     inmueble no puede hacer que un acta ya emitida deje de cotejar contra su
 *     propia huella.
 *
 * Corregir no es editar: `emitirCorreccion()` emite una versión nueva con folio
 * nuevo y deja la anterior intacta y verificando. No hay ninguna operación en
 * este módulo que reescriba un acta ya emitida.
 */

/** El acta se emite sobre una obra; pesa al menos tanto como editarla. */
const PERMISO = "can_edit_project" as const;

function datosInmuebleDe(proyecto: {
  matricula_inmobiliaria: string | null;
  direccion_inmueble: string | null;
  conjunto_edificio: string | null;
  unidad_inmueble: string | null;
  ciudad: string | null;
  tipo_propiedad: string | null;
  metraje_total: number | null;
  anio_construccion: number | null;
  altura_libre_m: number | null;
  habitada_durante_obra: boolean | null;
  solicitante: string | null;
}): DatosInmueble {
  return {
    matricula_inmobiliaria: proyecto.matricula_inmobiliaria,
    direccion_inmueble: proyecto.direccion_inmueble ?? "",
    conjunto_edificio: proyecto.conjunto_edificio,
    unidad_inmueble: proyecto.unidad_inmueble,
    ciudad: proyecto.ciudad,
    tipo_propiedad: (proyecto.tipo_propiedad as TipoPropiedad | null) ?? null,
    metraje_total: proyecto.metraje_total,
    anio_construccion: proyecto.anio_construccion,
    altura_libre_m: proyecto.altura_libre_m,
    habitada_durante_obra: proyecto.habitada_durante_obra,
    solicitante: proyecto.solicitante,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser();
    const ctx = await contextoProductosTecnicos(auth);

    const cuerpo = (await req.json().catch(() => null)) as {
      proyecto_id?: unknown;
      corrige_a?: unknown;
    } | null;

    const proyectoId = typeof cuerpo?.proyecto_id === "string" ? cuerpo.proyecto_id.trim() : "";
    if (!proyectoId) {
      return NextResponse.json({ error: "proyecto_id es requerido" }, { status: 400 });
    }
    await assertObraAccesible(ctx, proyectoId);

    if (!(await checkAdminProjectPermission(ctx.usuarioId, proyectoId, PERMISO))) {
      return NextResponse.json(
        { error: "No tienes permiso para emitir documentos de esta obra." },
        { status: 403 },
      );
    }

    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyectoId, constructora_id: ctx.constructoraId },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        matricula_inmobiliaria: true,
        direccion_inmueble: true,
        conjunto_edificio: true,
        unidad_inmueble: true,
        tipo_propiedad: true,
        metraje_total: true,
        anio_construccion: true,
        altura_libre_m: true,
        habitada_durante_obra: true,
        solicitante: true,
      },
    });
    if (!proyecto) {
      return NextResponse.json({ error: "Obra no encontrada" }, { status: 404 });
    }

    const edificios = await prisma.edificio.findMany({
      where: { proyecto_id: proyectoId },
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

    // Solo las vigentes: las descartadas siguen existiendo, pero no entran en el
    // documento. `storage_path` hace falta para congelar dónde está cada foto.
    const fotos = await prisma.productoTecnico.findMany({
      where: {
        proyecto_id: proyectoId,
        proyecto: { constructora_id: ctx.constructoraId },
        tipo: "REGISTRO_INICIAL",
        vigente: true,
      },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        unidad_id: true,
        storage_path: true,
        created_at: true,
      },
    });

    const perfil = await almacenPerfilFirma.leer(ctx.usuarioId);

    const filas: FotoRegistroFila[] = fotos.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      unidad_id: f.unidad_id,
      created_at: f.created_at.toISOString(),
    }));

    const payload = construirPayloadActa({
      obra: { id: proyecto.id, nombre: proyecto.nombre },
      inmueble: datosInmuebleDe(proyecto),
      arbol: edificios as ArbolInmueble,
      fotos: filas,
      profesional: { nombre: auth.usuario.nombre, matricula: perfil.matricula },
      emitidaEn: new Date(),
    });

    const contenido = serializarContenidoActa(payload);

    // ── Emisión ────────────────────────────────────────────────────────────
    const corrigeA = typeof cuerpo?.corrige_a === "string" ? cuerpo.corrige_a.trim() : "";
    let documento;

    if (corrigeA) {
      // La versión anterior tiene que ser de ESTA obra. `emitirCorreccion()`
      // busca por id sin saber de tenants: el acotado es responsabilidad de
      // quien lo llama, y se hace aquí antes de tocar nada.
      const anterior = await almacenPrisma.porId(corrigeA);
      if (
        !anterior ||
        anterior.proyecto_id !== proyectoId ||
        anterior.constructora_id !== ctx.constructoraId ||
        anterior.tipo !== "ACTA_ESTADO_INICIAL"
      ) {
        return NextResponse.json(
          { error: "No encontramos el acta que se quiere corregir." },
          { status: 404 },
        );
      }
      documento = await emitirCorreccion(corrigeA, {
        contenido,
        ciudad: proyecto.ciudad,
        piezas: payload.totalFotos,
      });
    } else {
      documento = await emitirDocumento({
        tipo: "ACTA_ESTADO_INICIAL",
        contenido,
        proyectoId: proyecto.id,
        constructoraId: ctx.constructoraId,
        ciudad: proyecto.ciudad,
        piezas: payload.totalFotos,
      });
    }

    // ── Copia congelada ────────────────────────────────────────────────────
    // Va DESPUÉS de emitir porque necesita el folio. Si fallara, el acta queda
    // emitida pero sin contenido imprimible: se avisa con claridad y se emite
    // otra. Es preferible a la alternativa —dar por buena un acta cuyo PDF se
    // reconstruiría desde datos que pueden haber cambiado—, que rompería en
    // silencio la única propiedad que hace útil la huella.
    try {
      await guardarSnapshotActa(proyecto.id, {
        version: 1,
        folio: documento.folio,
        contenido,
        rutas: Object.fromEntries(fotos.map((f) => [f.id, f.storage_path])),
      });
    } catch {
      console.error("POST /api/productos-tecnicos/acta: no se pudo congelar el contenido");
      return NextResponse.json(
        {
          error:
            "El acta se registró pero no pudimos guardar su contenido para imprimirla. " +
            "Vuelve a emitirla; esta quedará sin usar.",
          codigo: "SNAPSHOT_FALLIDO",
          folio: documento.folio,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: documento.id,
        folio: documento.folio,
        huellaCorta: hashCorto(documento.hash),
        version: documento.version,
        emitidaEl: fechaEnColombia(documento.created_at),
        totalFotos: payload.totalFotos,
        totalEspacios: payload.totalEspacios,
      },
      { status: 201 },
    );
  } catch (error) {
    if (esActaInicialError(error)) {
      return NextResponse.json({ error: error.message, codigo: error.codigo }, { status: 400 });
    }
    return respuestaDeError(error, "POST /api/productos-tecnicos/acta");
  }
}
