import type { EstadoCupo } from "@/lib/productos-tecnicos";
import type { ProductoApi, ResultadoApi } from "./api-productos-tecnicos";

/**
 * El único sitio del registro inicial que llama `fetch()`.
 *
 * FÍJATE EN LO QUE NO HAY: ninguna función que suba un archivo escogido por el
 * usuario. La única subida que este módulo sabe expresar recibe un `Blob` que
 * acaba de salir del `canvas` de la cámara, más el instante y las coordenadas de
 * esa captura. No es una restricción de la interfaz: no existe la llamada.
 *
 * La ruta genérica `POST /api/productos-tecnicos` —la que sube planos y renders
 * desde un archivo— no se importa aquí a propósito. Que el registro inicial no
 * tenga forma de nombrarla es parte de lo que hace imposible subir una foto de
 * galería a un documento que se presenta como prueba del estado previo.
 */

export interface ActaEmitida {
  id: string;
  folio: string;
  /** Los 12 hex que se imprimen en el pie, para cotejar. */
  huellaCorta: string;
  version: number;
  /** `AAAA-MM-DD` en la zona de Colombia. */
  emitidaEl: string;
  totalFotos: number;
  totalEspacios: number;
}

async function leerError(res: Response): Promise<{ error: string; codigo?: string }> {
  try {
    const cuerpo = await res.json();
    return { error: cuerpo.error ?? `Error ${res.status}`, codigo: cuerpo.codigo };
  } catch {
    return { error: `Error ${res.status}` };
  }
}

/** Lo que la cámara produce y esta capa manda. Nunca un `File` del disco. */
export interface CapturaParaSubir {
  proyectoId: string;
  espacioId: string;
  /** JPEG con fecha, hora y ubicación ya quemadas por `quemarOverlay`. */
  imagen: Blob;
  capturadaEn: Date;
  lat: number;
  lng: number;
  nota?: string | null;
}

/** Sube una foto recién capturada. El nombre del archivo lo pone esta capa. */
export async function subirFotoRegistro(
  captura: CapturaParaSubir,
): Promise<ResultadoApi<{ producto: ProductoApi; cupo: EstadoCupo }>> {
  const cuerpo = new FormData();
  cuerpo.append("file", captura.imagen, "registro-inicial.jpg");
  cuerpo.append("proyecto_id", captura.proyectoId);
  cuerpo.append("espacio_id", captura.espacioId);
  cuerpo.append("capturada_en", captura.capturadaEn.toISOString());
  cuerpo.append("lat", String(captura.lat));
  cuerpo.append("lng", String(captura.lng));
  if (captura.nota) cuerpo.append("nota", captura.nota);

  const res = await fetch("/api/productos-tecnicos/acta/foto", { method: "POST", body: cuerpo });
  if (!res.ok) return { ok: false, ...(await leerError(res)) };
  return { ok: true, datos: await res.json() };
}

/**
 * Descarta una foto del registro. No la borra: la saca de la vigencia, que es
 * lo que hace que deje de entrar en el acta. El archivo y la fila siguen ahí.
 */
export async function descartarFotoRegistro(
  id: string,
): Promise<ResultadoApi<{ producto: ProductoApi }>> {
  const res = await fetch(`/api/productos-tecnicos/acta/foto/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ descartada: true }),
  });
  if (!res.ok) return { ok: false, ...(await leerError(res)) };
  return { ok: true, datos: await res.json() };
}

/** Emite el acta. Con `corrigeA`, emite la corrección de un acta anterior. */
export async function emitirActaInicial(
  proyectoId: string,
  corrigeA?: string | null,
): Promise<ResultadoApi<ActaEmitida>> {
  const res = await fetch("/api/productos-tecnicos/acta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proyecto_id: proyectoId, corrige_a: corrigeA ?? null }),
  });
  if (!res.ok) return { ok: false, ...(await leerError(res)) };
  return { ok: true, datos: await res.json() };
}

/** Dónde se descarga el PDF de un acta ya emitida. */
export function rutaPdfActa(documentoId: string): string {
  return `/api/productos-tecnicos/acta/${encodeURIComponent(documentoId)}/pdf`;
}
