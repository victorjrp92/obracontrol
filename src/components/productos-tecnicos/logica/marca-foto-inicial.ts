import type { GPSCoords } from "@/lib/media/overlay";

/**
 * La marca que acompaña a CADA foto del registro fotográfico inicial.
 *
 * Qué problema resuelve. La discusión que este producto existe para ganar es
 * «esa grieta ya estaba» contra «no, la hiciste tú». Una foto sin fecha, sin
 * hora y sin ubicación no la gana: la contraparte solo tiene que decir que la
 * tomaron después. Por eso la app quema fecha, hora y coordenadas DENTRO de la
 * imagen (`quemarOverlay`, `src/lib/media/overlay.ts`) y, además, deja aquí el
 * mismo dato en texto — la imagen es lo que se ve, esto es lo que se comprueba.
 *
 * DÓNDE VIVE. En la columna `descripcion` de `productos_tecnicos`, serializada
 * como JSON. No es una elección de estilo: `prisma/` está congelado para este
 * trabajo y `ProductoTecnico` no tiene columnas para espacio, instante de
 * captura ni coordenadas. Mismo criterio que `perfil-firma.ts` en leaf-4.2,
 * que guarda el perfil del profesional en el bucket porque `usuarios` no tenía
 * dónde. El día que el modelo tenga columnas, lo único que cambia es este
 * archivo.
 *
 * LA REGLA QUE HACE ÚTIL TODO ESTO: una fila de `REGISTRO_INICIAL` cuya
 * `descripcion` no contenga una marca VÁLIDA no es una foto del registro. No se
 * «tolera», no se pinta en gris, no entra en el acta: `leerMarca()` devuelve
 * `null` y el acta se niega a emitirse. Esa negativa es la que impide que una
 * foto sin fecha —una de galería, por ejemplo, subida por la ruta genérica de
 * productos técnicos— acabe dentro de un documento que se presenta como prueba
 * del estado previo.
 *
 * Módulo puro: sin React, sin red, sin Prisma. Lo comparten el navegador (que
 * la construye), la ruta de subida (que la valida) y `scripts/verificar-acta-inicial.ts`.
 */

/** Versión del formato. Sube si alguna vez cambia la forma de la marca. */
export const VERSION_MARCA = 1;

/**
 * Qué se quemó en la imagen. Es una constante y no un booleano a propósito: un
 * `true` no dice QUÉ lleva la foto encima, y lo que hay que poder afirmar en un
 * documento es exactamente eso — fecha, hora y ubicación.
 */
export const OVERLAY_FECHA_HORA_UBICACION = "fecha-hora-ubicacion";

/** Tope de la nota del profesional. `descripcion` admite 1000; el resto es la marca. */
export const NOTA_LARGO_MAX = 400;

export interface MarcaFotoInicial {
  v: number;
  /** Id del `Espacio` al que pertenece la foto. */
  espacioId: string;
  /** Nombre del espacio CONGELADO en el momento de la captura. */
  espacio: string;
  /** Unidad de la que cuelga el espacio. Es la que va en `unidad_id` de la fila. */
  unidadId: string;
  /** Instante de la captura, ISO 8601. El mismo que se quemó en la imagen. */
  capturadaEn: string;
  lat: number;
  lng: number;
  /** Qué lleva quemado la imagen. Solo un valor es admisible. */
  overlay: string;
  /** Observación opcional del profesional sobre lo que muestra la foto. */
  nota: string | null;
}

/** Lo que hace falta para construir una marca. */
export interface DatosMarca {
  espacioId: string;
  espacio: string;
  unidadId: string;
  capturadaEn: Date;
  gps: GPSCoords;
  nota?: string | null;
}

function textoUtil(valor: unknown, max = 200): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  if (limpio.length === 0 || limpio.length > max) return null;
  return limpio;
}

/** ¿Un número que se puede imprimir como coordenada? */
function coordenada(valor: unknown, tope: number): number | null {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return null;
  if (valor < -tope || valor > tope) return null;
  return valor;
}

/**
 * Construye la marca. Lanza si le falta algo, en vez de rellenar con valores por
 * defecto: una foto sin coordenadas no es «una foto con coordenadas vacías», es
 * una foto que no sirve para lo que se está haciendo.
 */
export function construirMarca(datos: DatosMarca): MarcaFotoInicial {
  const espacioId = textoUtil(datos.espacioId, 64);
  const unidadId = textoUtil(datos.unidadId, 64);
  const espacio = textoUtil(datos.espacio, 160);
  if (!espacioId || !unidadId || !espacio) {
    throw new Error("La foto tiene que decir en qué espacio del inmueble se tomó.");
  }
  if (!(datos.capturadaEn instanceof Date) || Number.isNaN(datos.capturadaEn.getTime())) {
    throw new Error("La foto tiene que traer el instante en que se tomó.");
  }
  const lat = coordenada(datos.gps?.lat, 90);
  const lng = coordenada(datos.gps?.lng, 180);
  if (lat === null || lng === null) {
    throw new Error("La foto tiene que traer la ubicación del momento de la captura.");
  }

  const nota = typeof datos.nota === "string" ? datos.nota.trim().slice(0, NOTA_LARGO_MAX) : "";

  return {
    v: VERSION_MARCA,
    espacioId,
    espacio,
    unidadId,
    capturadaEn: datos.capturadaEn.toISOString(),
    lat,
    lng,
    overlay: OVERLAY_FECHA_HORA_UBICACION,
    nota: nota.length > 0 ? nota : null,
  };
}

/** La marca tal como se guarda en `descripcion`. Orden de claves fijo. */
export function serializarMarca(marca: MarcaFotoInicial): string {
  return JSON.stringify({
    v: marca.v,
    espacioId: marca.espacioId,
    espacio: marca.espacio,
    unidadId: marca.unidadId,
    capturadaEn: marca.capturadaEn,
    lat: marca.lat,
    lng: marca.lng,
    overlay: marca.overlay,
    nota: marca.nota,
  });
}

/**
 * Lee la marca de una `descripcion`. `null` si no hay marca, si está rota, si es
 * de otra versión, o si le falta cualquiera de las tres cosas que la hacen
 * valer: instante, coordenadas y constancia de que la imagen lleva el overlay.
 *
 * Es el único camino de vuelta. Quien consuma fotos del registro pasa por aquí,
 * así que no existe una ruta por la que una foto sin fecha entre a un documento.
 */
export function leerMarca(descripcion: string | null | undefined): MarcaFotoInicial | null {
  if (typeof descripcion !== "string" || descripcion.trim().length === 0) return null;

  let crudo: unknown;
  try {
    crudo = JSON.parse(descripcion);
  } catch {
    return null;
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return null;

  const datos = crudo as Record<string, unknown>;
  if (datos.v !== VERSION_MARCA) return null;
  if (datos.overlay !== OVERLAY_FECHA_HORA_UBICACION) return null;

  const espacioId = textoUtil(datos.espacioId, 64);
  const unidadId = textoUtil(datos.unidadId, 64);
  const espacio = textoUtil(datos.espacio, 160);
  if (!espacioId || !unidadId || !espacio) return null;

  const capturadaEn = textoUtil(datos.capturadaEn, 40);
  if (!capturadaEn || Number.isNaN(Date.parse(capturadaEn))) return null;

  const lat = coordenada(datos.lat, 90);
  const lng = coordenada(datos.lng, 180);
  if (lat === null || lng === null) return null;

  const nota = typeof datos.nota === "string" ? datos.nota.trim().slice(0, NOTA_LARGO_MAX) : "";

  return {
    v: VERSION_MARCA,
    espacioId,
    espacio,
    unidadId,
    capturadaEn,
    lat,
    lng,
    overlay: OVERLAY_FECHA_HORA_UBICACION,
    nota: nota.length > 0 ? nota : null,
  };
}

/** ¿Esta fila del registro lleva fecha, hora y ubicación quemadas? */
export function tieneOverlay(descripcion: string | null | undefined): boolean {
  return leerMarca(descripcion) !== null;
}

/** Coordenadas como se imprimen en el documento: seis decimales, igual que el overlay. */
export function coordenadasImpresas(marca: Pick<MarcaFotoInicial, "lat" | "lng">): string {
  return `${marca.lat.toFixed(6)}, ${marca.lng.toFixed(6)}`;
}
