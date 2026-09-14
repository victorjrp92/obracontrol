import { canAccessProject, getAccessibleProjectIds } from "@/lib/access";
import type { QuienPregunta } from "@/lib/data-campo";
import { prisma } from "@/lib/prisma";
import { firmarEvidencias } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────
// UNA TAREA, PARA REPORTARLA  (/campo/[proyectoId]/tarea/[id])
//
// Vive junto a la pantalla que lo usa —como `estados-obra.ts` y
// `EstadoTareaBadge.tsx` en esta misma zona— porque es su único consumidor:
// esta forma no le sirve a nada fuera de /campo.
//
// Rige la misma regla que el resto de la zona (ver la cabecera de
// `src/lib/data-campo.ts`): DOS filtros, siempre los dos —constructora Y obra
// asignada—, y ni `precio` ni `presupuesto_*` salen de la base. Este nivel
// está fuera de `canManageTaskPrice`; lo que no se consulta no se puede
// filtrar por descuido en una vista.
//
// Este módulo tampoco escribe. El reporte lo hace POST /api/tareas/[id]/reportar
// y las fotos POST /api/evidencias — aquí solo se lee lo que la pantalla pinta.
// ─────────────────────────────────────────────────────────────────────────

/** Tope de fotos por tarea que impone el servidor en POST /api/evidencias. */
export const MAX_FOTOS_POR_TAREA = 4;

export interface EvidenciaCampo {
  id: string;
  tipo: "FOTO" | "VIDEO";
  /** URL FIRMADA: el bucket es privado, la ruta cruda da 404 en un `<img>`. */
  url: string;
  gpsLat: number | null;
  gpsLng: number | null;
  timestampCaptura: string;
}

export interface TareaCampoDetalle {
  id: string;
  nombre: string;
  estado: string;
  subfase: string | null;
  tiempoAcordadoDias: number;
  /** Quién la ejecuta. El personal de campo NUNCA es este nombre. */
  asignadoNombre: string | null;
  /** "Torre A · Piso 3 · Apto 301 · Cocina". */
  ubicacion: string;
  faseNombre: string;
  proyectoId: string;
  proyectoNombre: string;
  notaReporte: string | null;
  /** Por qué se devolvió, si el último veredicto fue un rechazo. */
  motivoRechazo: string | null;
  fotoReferenciaUrl: string | null;
  /** Evidencia del intento ACTUAL: la posterior al último rechazo. */
  evidencias: EvidenciaCampo[];
  /**
   * Cuántas fotos FIRMA el tope del servidor. Se cuentan TODAS las de la
   * tarea, no las del intento actual, porque así las cuenta el guardia de
   * POST /api/evidencias: saberlo aquí es lo que permite avisar antes de
   * abrir la cámara en vez de fallar con el pulgar en el obturador.
   */
  fotosAcumuladas: number;
}

function leerMotivo(justificacion: unknown): string | null {
  if (typeof justificacion !== "object" || justificacion === null) return null;
  const motivo = (justificacion as Record<string, unknown>).motivo;
  return typeof motivo === "string" && motivo.trim().length > 0 ? motivo : null;
}

/**
 * La tarea como la ve el personal de campo. Devuelve `null` cuando la obra no
 * es suya, cuando la tarea no es de esa obra o cuando no existe: los tres
 * casos se contestan igual a propósito, porque distinguirlos ya diría si esa
 * tarea existe. El `proyectoId` viaja en la ruta y se exige en el `where` —
 * un id de tarea de otra obra suya seguiría siendo suyo, pero la pantalla
 * volvería a una obra que no la contiene.
 */
export async function getTareaCampo(
  quien: QuienPregunta,
  proyectoId: string,
  tareaId: string,
): Promise<TareaCampoDetalle | null> {
  const accesibles = await getAccessibleProjectIds(
    quien.usuarioId,
    quien.constructoraId,
    quien.nivelAcceso,
  );
  if (!canAccessProject(accesibles, proyectoId)) return null;

  const tarea = await prisma.tarea.findFirst({
    where: {
      id: tareaId,
      espacio: {
        unidad: {
          piso: {
            edificio: {
              proyecto: { id: proyectoId, constructora_id: quien.constructoraId },
            },
          },
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      estado: true,
      subfase: true,
      tiempo_acordado_dias: true,
      nota_reporte: true,
      foto_referencia_url: true,
      asignado_usuario: { select: { nombre: true } },
      fase: { select: { nombre: true } },
      espacio: {
        select: {
          nombre: true,
          unidad: {
            select: {
              nombre: true,
              piso: {
                select: {
                  numero: true,
                  edificio: {
                    select: {
                      nombre: true,
                      proyecto: { select: { id: true, nombre: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      evidencias: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          tipo: true,
          url_storage: true,
          gps_lat: true,
          gps_lng: true,
          timestamp_captura: true,
          created_at: true,
        },
      },
      aprobaciones: {
        where: { estado: "NO_APROBADA" },
        orderBy: { fecha: "desc" },
        take: 1,
        select: { fecha: true, justificacion_por_item: true },
      },
    },
  });
  if (!tarea) return null;

  // La evidencia del intento rechazado se conserva en base para auditoría,
  // pero no es la que se está mirando hoy: la revisión en curso es lo que vino
  // DESPUÉS del último rechazo. Misma regla que `getTareaDetalle`.
  const ultimoRechazo = tarea.aprobaciones[0] ?? null;
  const delIntentoActual = ultimoRechazo
    ? tarea.evidencias.filter((e) => e.created_at > ultimoRechazo.fecha)
    : tarea.evidencias;

  // Una sola llamada a Storage para las evidencias y la foto de referencia:
  // firmar de a una son N viajes dentro del render de un server component.
  const firmadas = await firmarEvidencias([
    ...delIntentoActual.map((e) => e.url_storage),
    ...(tarea.foto_referencia_url ? [tarea.foto_referencia_url] : []),
  ]);

  const { espacio } = tarea;
  const { unidad } = espacio;
  const { piso } = unidad;
  const { edificio } = piso;

  return {
    id: tarea.id,
    nombre: tarea.nombre,
    estado: tarea.estado,
    subfase: tarea.subfase,
    tiempoAcordadoDias: tarea.tiempo_acordado_dias,
    asignadoNombre: tarea.asignado_usuario?.nombre ?? null,
    ubicacion: `${edificio.nombre} · Piso ${piso.numero} · ${unidad.nombre} · ${espacio.nombre}`,
    faseNombre: tarea.fase.nombre,
    proyectoId: edificio.proyecto.id,
    proyectoNombre: edificio.proyecto.nombre,
    notaReporte: tarea.nota_reporte,
    motivoRechazo: ultimoRechazo ? leerMotivo(ultimoRechazo.justificacion_por_item) : null,
    fotoReferenciaUrl: tarea.foto_referencia_url
      ? firmadas.get(tarea.foto_referencia_url) ?? null
      : null,
    evidencias: delIntentoActual.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      url: firmadas.get(e.url_storage) ?? "",
      gpsLat: e.gps_lat,
      gpsLng: e.gps_lng,
      timestampCaptura: e.timestamp_captura.toISOString(),
    })),
    fotosAcumuladas: tarea.evidencias.filter((e) => e.tipo === "FOTO").length,
  };
}
