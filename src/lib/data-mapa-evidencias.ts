import { prisma } from "@/lib/prisma";
import type { AccessibleProjects } from "@/lib/access";
import { firmarEvidencias } from "@/lib/storage";
import {
  coordenadaValida,
  distanciaMetros,
  fueraDeRadio,
  type Coordenada,
} from "@/lib/distancia-obra";

// ---------------------------------------------------------------------------
// Carga del MAPA DE EVIDENCIAS: la prueba de que se estuvo ahí.
//
// El 99,94% de las fotos de la base llega con coordenadas del móvil, y hasta hoy
// ese dato solo se veía como cinco decimales dentro del detalle de UNA tarea.
// Agregado sobre el mapa contesta lo que ninguna otra pantalla contesta: DÓNDE
// se hizo el trabajo, y si esa foto se tomó en el apartamento 301 o en otra
// parte.
//
// ══ TRES DECISIONES DE CARGA ═══════════════════════════════════════════════
//
// 1. DOS consultas y no una. La obra más grande de producción tiene 3.348
//    evidencias. Traer nombre de tarea, fase, torre, piso, unidad, espacio y
//    autor para las 3.348 es un join de siete tablas que no se usa: el mapa
//    solo necesita id y coordenadas. El detalle (la foto, la tarea, quién,
//    cuándo) se pide por evidencia al pinchar una — ver `getDetalleEvidencia`.
//
// 2. NO se firma nada aquí. `firmarEvidencias` va por lotes en una sola
//    llamada, pero firmar 3.348 URLs de las que se mirarán tres es regalarle a
//    Supabase el trabajo y al usuario la espera. Se firma la que se abre.
//
// 3. La CLASIFICACIÓN (con ubicación / sin ubicación / fuera del radio) se hace
//    aquí en una sola pasada sobre las mismas filas, y de ahí salen a la vez
//    los puntos del mapa y los contadores. Si el contador se calculara con un
//    `count` de Prisma y el mapa con esta lista, un `gps_lat` no nulo pero
//    inválido saldría contado en un lado y no en el otro, y el reporte se
//    contradiría consigo mismo.
//
// El filtro de tenant va por `proyecto.constructora_id` ADEMÁS del id del
// proyecto: con solo el id, uno adivinado devolvería las fotos —y las
// coordenadas de las casas— de otra constructora.
// ---------------------------------------------------------------------------

/**
 * Tope de evidencias sin ubicación que se listan con su detalle.
 *
 * No es un tope sobre el CONTADOR: ese cuenta todas. Es sobre la lista que se
 * pinta, para no armar una página de mil filas. En producción son 2 de 3.401,
 * así que el tope no se toca nunca; existe para el día en que un permiso de
 * ubicación denegado en un lote de obreros llene la tabla.
 */
const TOPE_SIN_UBICACION = 200;

export interface ObraDelMapa {
  id: string;
  nombre: string;
  /** `null` cuando la obra no tiene `ubicacion_lat` / `ubicacion_lng`. */
  ubicacion: Coordenada | null;
  direccion: string | null;
}

/** Lo mínimo que el mapa necesita por foto. Se envían miles: va sin grasa. */
export interface PuntoEvidencia {
  id: string;
  lat: number;
  lng: number;
  /** Metros hasta el punto de la obra. `null` si la obra no está ubicada. */
  distancia: number | null;
  /**
   * 1 si cae fuera del radio elegido. Numérico y no booleano porque Mapbox lo
   * suma dentro de cada clúster (`clusterProperties`) para poder pintar de otro
   * color el grupo que esconde un punto lejano.
   */
  fuera: 0 | 1;
}

/** Una foto que existe pero no sabe dónde se tomó. Se enseña, no se esconde. */
export interface EvidenciaSinUbicacion {
  id: string;
  tareaId: string;
  tarea: string;
  ubicacion: string;
  autor: string;
  /** ISO: un server component no puede pasar `Date` a un cliente sin serializar. */
  fecha: string;
  tipo: "FOTO" | "VIDEO";
}

export interface ConteoEvidencias {
  total: number;
  conUbicacion: number;
  sinUbicacion: number;
  /** `null` cuando la obra no está ubicada: sin origen no hay distancia que medir. */
  fueraDelRadio: number | null;
}

export interface DatosMapaEvidencias {
  obra: ObraDelMapa;
  radioMetros: number;
  puntos: PuntoEvidencia[];
  sinUbicacion: EvidenciaSinUbicacion[];
  conteo: ConteoEvidencias;
}

/** El detalle de UNA foto, ya con la URL firmada. */
export interface DetalleEvidencia {
  id: string;
  tipo: "FOTO" | "VIDEO";
  /** URL firmada y temporal. Cadena vacía si no se pudo firmar. */
  url: string;
  tareaId: string;
  tarea: string;
  fase: string;
  ubicacion: string;
  autor: string;
  fecha: string;
  distancia: number | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Fragmento `where` de una evidencia que pertenece a ESTA obra y a ESTA
 * constructora. El camino es evidencia → tarea → espacio → unidad → piso →
 * edificio → proyecto: es el único que hay, porque la evidencia no guarda el
 * proyecto.
 */
function evidenciaDeLaObra(proyectoId: string, constructoraId: string) {
  return {
    tarea: {
      espacio: {
        unidad: {
          piso: {
            edificio: {
              proyecto_id: proyectoId,
              proyecto: { constructora_id: constructoraId },
            },
          },
        },
      },
    },
  } as const;
}

/** "Torre A · Piso 3 · Apto 301 · Cocina", saltándose lo que venga vacío. */
function textoUbicacion(e: {
  espacio: {
    nombre: string;
    unidad: { nombre: string; piso: { numero: number; edificio: { nombre: string } } };
  };
}): string {
  const u = e.espacio.unidad;
  return [u.piso.edificio.nombre, `Piso ${u.piso.numero}`, u.nombre, e.espacio.nombre]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Quién tomó la foto. La evidencia apunta a un `Usuario` (contratista o admin
 * que reporta desde el panel) o a un `Obrero` (que entra por token sin cuenta).
 * Las dos vías existen y las dos cuentan: el reporte es sobre QUIÉN hizo, y
 * dejar al obrero como «sin registrar» borraría justo al que estuvo ahí.
 */
function textoAutor(e: {
  usuario: { nombre: string } | null;
  obrero: { nombre: string } | null;
}): string {
  return e.usuario?.nombre ?? e.obrero?.nombre ?? "Sin registrar";
}

/** Las obras del selector. Ligera a propósito: solo nombre y si está ubicada. */
export async function getObrasParaMapaEvidencias(
  constructoraId: string,
  accessibleProjectIds?: AccessibleProjects,
): Promise<{ id: string; nombre: string; ubicada: boolean }[]> {
  // El mismo recorte que usa el resto del dashboard: un ADMIN_PROYECTO no puede
  // ver en el selector obras que no le asignaron.
  const where =
    accessibleProjectIds !== undefined && accessibleProjectIds !== "ALL"
      ? { constructora_id: constructoraId, id: { in: accessibleProjectIds } }
      : { constructora_id: constructoraId };

  const obras = await prisma.proyecto.findMany({
    where,
    select: { id: true, nombre: true, ubicacion_lat: true, ubicacion_lng: true },
    orderBy: { created_at: "desc" },
  });

  return obras.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    ubicada: coordenadaValida(
      o.ubicacion_lat !== null && o.ubicacion_lng !== null
        ? { lat: o.ubicacion_lat, lng: o.ubicacion_lng }
        : null,
    ),
  }));
}

export async function getMapaEvidencias(
  proyectoId: string,
  constructoraId: string,
  radioMetros: number,
): Promise<DatosMapaEvidencias | null> {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, constructora_id: constructoraId },
    select: {
      id: true,
      nombre: true,
      ubicacion_lat: true,
      ubicacion_lng: true,
      direccion_inmueble: true,
    },
  });
  if (!proyecto) return null;

  // La obra puede no estar ubicada: `ubicacion_lat` y `ubicacion_lng` son
  // opcionales en el esquema y muchas obras viejas se crearon sin pasar por el
  // selector de mapa. Sin origen NO se inventa uno: la distancia queda en null
  // y la pantalla lo dice, en vez de pintar "0 km" para todas.
  const ubicacionObra: Coordenada | null =
    proyecto.ubicacion_lat !== null && proyecto.ubicacion_lng !== null
      ? { lat: proyecto.ubicacion_lat, lng: proyecto.ubicacion_lng }
      : null;
  const obraUbicada = coordenadaValida(ubicacionObra);

  const filas = await prisma.evidencia.findMany({
    where: evidenciaDeLaObra(proyectoId, constructoraId),
    select: { id: true, gps_lat: true, gps_lng: true },
    orderBy: { timestamp_captura: "desc" },
  });

  const puntos: PuntoEvidencia[] = [];
  const idsSinUbicacion: string[] = [];

  for (const f of filas) {
    const coords: Coordenada | null =
      f.gps_lat !== null && f.gps_lng !== null ? { lat: f.gps_lat, lng: f.gps_lng } : null;

    // `coordenadaValida` descarta nulos, NaN, rangos imposibles y (0,0). Una
    // foto así EXISTE y cuenta: se va a la lista de «sin ubicación», no al
    // limbo. Esconderla convertiría el reporte en una mentira por omisión.
    if (!coordenadaValida(coords)) {
      idsSinUbicacion.push(f.id);
      continue;
    }

    const distancia = obraUbicada ? distanciaMetros(ubicacionObra, coords) : null;
    puntos.push({
      id: f.id,
      lat: coords.lat,
      lng: coords.lng,
      distancia,
      fuera: fueraDeRadio(distancia, radioMetros) ? 1 : 0,
    });
  }

  // Detalle solo de las que se van a listar. El contador de abajo usa
  // `idsSinUbicacion.length`, que sí son todas.
  const sinUbicacion = await detalleSinUbicacion(idsSinUbicacion.slice(0, TOPE_SIN_UBICACION));

  return {
    obra: {
      id: proyecto.id,
      nombre: proyecto.nombre,
      ubicacion: obraUbicada ? ubicacionObra : null,
      direccion: proyecto.direccion_inmueble,
    },
    radioMetros,
    puntos,
    sinUbicacion,
    conteo: {
      total: filas.length,
      conUbicacion: puntos.length,
      sinUbicacion: idsSinUbicacion.length,
      // Sin obra ubicada no hay «fuera del radio» que contar. Un 0 aquí se
      // leería como «ninguna foto es sospechosa», que no es lo que sabemos:
      // lo que sabemos es que no se puede saber.
      fueraDelRadio: obraUbicada ? puntos.filter((p) => p.fuera === 1).length : null,
    },
  };
}

/** Completa las filas de la tabla «sin ubicación». Los ids ya vienen filtrados por tenant. */
async function detalleSinUbicacion(ids: string[]): Promise<EvidenciaSinUbicacion[]> {
  if (ids.length === 0) return [];

  const filas = await prisma.evidencia.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      tipo: true,
      timestamp_captura: true,
      tarea_id: true,
      usuario: { select: { nombre: true } },
      obrero: { select: { nombre: true } },
      tarea: {
        select: {
          nombre: true,
          espacio: {
            select: {
              nombre: true,
              unidad: {
                select: {
                  nombre: true,
                  piso: { select: { numero: true, edificio: { select: { nombre: true } } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { timestamp_captura: "desc" },
  });

  return filas.map((f) => ({
    id: f.id,
    tareaId: f.tarea_id,
    tarea: f.tarea.nombre,
    ubicacion: textoUbicacion(f.tarea),
    autor: textoAutor(f),
    fecha: f.timestamp_captura.toISOString(),
    tipo: f.tipo,
  }));
}

/**
 * El detalle de UNA evidencia, con su URL firmada.
 *
 * Se pide al pinchar un punto del mapa. Recibe el `proyectoId` además del id de
 * la evidencia —y filtra por los dos— para que un id de evidencia adivinado no
 * sirva de nada: quien llama ya validó que el usuario tiene acceso a ESA obra,
 * y este filtro ata la evidencia a ella. Devuelve `null` si no encaja, sin
 * distinguir «no existe» de «no es tuya».
 */
export async function getDetalleEvidencia(
  proyectoId: string,
  evidenciaId: string,
  constructoraId: string,
  ubicacionObra: Coordenada | null,
): Promise<DetalleEvidencia | null> {
  const e = await prisma.evidencia.findFirst({
    where: { id: evidenciaId, ...evidenciaDeLaObra(proyectoId, constructoraId) },
    select: {
      id: true,
      tipo: true,
      url_storage: true,
      gps_lat: true,
      gps_lng: true,
      timestamp_captura: true,
      tarea_id: true,
      usuario: { select: { nombre: true } },
      obrero: { select: { nombre: true } },
      tarea: {
        select: {
          nombre: true,
          fase: { select: { nombre: true } },
          espacio: {
            select: {
              nombre: true,
              unidad: {
                select: {
                  nombre: true,
                  piso: { select: { numero: true, edificio: { select: { nombre: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!e) return null;

  // Una sola ruta, pero por `firmarEvidencias` y no por `getSignedEvidenciaUrl`:
  // aquella tolera además las URL absolutas de los registros viejos (el bucket
  // fue público antes de pasar a signed URLs) y devuelve cadena vacía en vez de
  // reventar si la firma falla. Una foto que no carga es un hueco, no una
  // pantalla caída.
  const firmadas = await firmarEvidencias([e.url_storage]);

  const coords: Coordenada | null =
    e.gps_lat !== null && e.gps_lng !== null ? { lat: e.gps_lat, lng: e.gps_lng } : null;

  return {
    id: e.id,
    tipo: e.tipo,
    url: firmadas.get(e.url_storage) ?? "",
    tareaId: e.tarea_id,
    tarea: e.tarea.nombre,
    fase: e.tarea.fase.nombre,
    ubicacion: textoUbicacion(e.tarea),
    autor: textoAutor(e),
    fecha: e.timestamp_captura.toISOString(),
    distancia: distanciaMetros(ubicacionObra, coords),
    lat: coordenadaValida(coords) ? coords.lat : null,
    lng: coordenadaValida(coords) ? coords.lng : null,
  };
}
