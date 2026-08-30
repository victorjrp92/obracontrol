import type { TipoProductoTecnico } from "@/generated/prisma";
import { fallar } from "./errores";
import type { ArchivoEntrante } from "./tipos";

/**
 * Qué es de verdad el archivo que acaban de subir.
 *
 * La extensión del nombre y el `Content-Type` los pone quien sube: los dos se
 * falsifican escribiendo. Un `.pdf` que en realidad es un ejecutable, o un
 * `.png` que es un HTML con `<script>`, entran igual si solo se mira el
 * nombre. Lo único que no se falsifica sin fabricar el archivo entero son los
 * primeros bytes, así que la decisión se toma ahí y el nombre pasa a ser una
 * pista que hay que CONTRASTAR, no una fuente.
 *
 * Consecuencia práctica: el `mime` que se guarda en la base sale de esta
 * tabla, nunca del cliente. Y cuando el contenido contradice a la extensión se
 * rechaza en vez de "corregir" en silencio — un archivo cuyo nombre miente es
 * un intento, no un despiste.
 */

export type Formato = "pdf" | "png" | "jpeg" | "webp";

export interface FirmaArchivo {
  formato: Formato;
  /** MIME canónico. Es el que se persiste. */
  mime: string;
  /** Extensiones que un archivo de este formato puede llevar legítimamente. */
  extensiones: readonly string[];
  /** Nombre para mensajes de error, en mayúsculas. */
  etiqueta: string;
  coincide(cabecera: Uint8Array): boolean;
}

/**
 * Cuántos bytes hay que leer del principio del archivo. El más exigente es
 * WEBP, que necesita llegar al byte 12 (`RIFF....WEBP`). Se leen 16 por
 * holgura: son 16 bytes, no el archivo.
 */
export const BYTES_CABECERA = 16;

function coincideEn(cabecera: Uint8Array, desde: number, patron: readonly number[]): boolean {
  if (cabecera.length < desde + patron.length) return false;
  for (let i = 0; i < patron.length; i++) {
    if (cabecera[desde + i] !== patron[i]) return false;
  }
  return true;
}

/** Las firmas, en orden de comprobación. */
export const FIRMAS: readonly FirmaArchivo[] = [
  {
    formato: "pdf",
    mime: "application/pdf",
    extensiones: ["pdf"],
    etiqueta: "PDF",
    // "%PDF-"
    coincide: (c) => coincideEn(c, 0, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  },
  {
    formato: "png",
    mime: "image/png",
    extensiones: ["png"],
    etiqueta: "PNG",
    // \x89PNG\r\n\x1a\n
    coincide: (c) => coincideEn(c, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    formato: "jpeg",
    mime: "image/jpeg",
    extensiones: ["jpg", "jpeg"],
    etiqueta: "JPEG",
    // SOI + primer marcador
    coincide: (c) => coincideEn(c, 0, [0xff, 0xd8, 0xff]),
  },
  {
    formato: "webp",
    mime: "image/webp",
    extensiones: ["webp"],
    etiqueta: "WEBP",
    // "RIFF" ....(tamaño).... "WEBP" — hay que comprobar las DOS mitades:
    // "RIFF" solo también lo cumplen un .wav y un .avi.
    coincide: (c) =>
      coincideEn(c, 0, [0x52, 0x49, 0x46, 0x46]) && coincideEn(c, 8, [0x57, 0x45, 0x42, 0x50]),
  },
];

/**
 * Qué formatos acepta cada tipo de producto.
 *
 * El registro fotográfico inicial es SOLO imagen a propósito: es la prueba de
 * cómo estaba el inmueble antes de tocarlo, y un PDF ahí es un contenedor
 * donde cabe cualquier cosa (texto reescrito, páginas añadidas) sin que se
 * note. Planos y renders sí aceptan PDF porque el PDF vectorial es el formato
 * en que un arquitecto entrega.
 */
export const FORMATOS_POR_TIPO: Record<TipoProductoTecnico, readonly Formato[]> = {
  REGISTRO_INICIAL: ["png", "jpeg", "webp"],
  PLANO: ["pdf", "png", "jpeg", "webp"],
  RENDER: ["pdf", "png", "jpeg", "webp"],
};

/**
 * MIMEs que el navegador puede mandar y a qué formato corresponden. Solo se
 * usa para detectar una CONTRADICCIÓN; un MIME ausente o genérico
 * (`application/octet-stream`) no dice nada y no se castiga.
 */
const MIME_A_FORMATO: Readonly<Record<string, Formato>> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/webp": "webp",
};

/** Extensión en minúsculas, sin punto. `null` si el nombre no trae ninguna. */
export function extensionDe(nombreArchivo: string): string | null {
  const limpio = nombreArchivo.trim();
  const punto = limpio.lastIndexOf(".");
  if (punto <= 0 || punto === limpio.length - 1) return null;
  return limpio.slice(punto + 1).toLowerCase();
}

/** Extensión canónica con la que se guarda un formato. */
export function extensionCanonica(formato: Formato): string {
  const firma = FIRMAS.find((f) => f.formato === formato);
  return firma ? firma.extensiones[0] : "bin";
}

/** Qué es el archivo según sus primeros bytes. `null` si no es nada conocido. */
export function detectarFormato(cabecera: Uint8Array): FirmaArchivo | null {
  return FIRMAS.find((firma) => firma.coincide(cabecera)) ?? null;
}

/**
 * Valida el archivo contra el tipo de producto y devuelve su firma real.
 *
 * Lanza `ProductoTecnicoError` con 415 en todos los casos de tipo: el archivo
 * llegó bien formado, lo que no se soporta es su contenido.
 */
export function validarArchivo(
  tipo: TipoProductoTecnico,
  archivo: ArchivoEntrante,
): FirmaArchivo {
  const firma = detectarFormato(archivo.cabecera);
  if (!firma) {
    fallar(
      415,
      "FORMATO_NO_RECONOCIDO",
      "No reconocemos este archivo. Se aceptan PDF, PNG, JPEG y WEBP.",
    );
  }

  const permitidos = FORMATOS_POR_TIPO[tipo];
  if (!permitidos.includes(firma.formato)) {
    const lista = permitidos
      .map((f) => FIRMAS.find((x) => x.formato === f)?.etiqueta ?? f)
      .join(", ");
    fallar(
      415,
      "FORMATO_NO_PERMITIDO",
      tipo === "REGISTRO_INICIAL"
        ? `El registro fotográfico solo acepta imágenes (${lista}); este archivo es ${firma.etiqueta}.`
        : `Este tipo de producto acepta ${lista}; este archivo es ${firma.etiqueta}.`,
    );
  }

  const extension = extensionDe(archivo.nombre);
  if (extension && !firma.extensiones.includes(extension)) {
    fallar(
      415,
      "EXTENSION_ENGANOSA",
      `El archivo se llama «.${extension}» pero su contenido es ${firma.etiqueta}. Renómbralo o sube el archivo correcto.`,
    );
  }

  const declarado = (archivo.mimeDeclarado ?? "").trim().toLowerCase();
  const formatoDeclarado = declarado ? MIME_A_FORMATO[declarado] : undefined;
  if (formatoDeclarado && formatoDeclarado !== firma.formato) {
    fallar(
      415,
      "MIME_ENGANOSO",
      `El archivo se envió como «${declarado}» pero su contenido es ${firma.etiqueta}.`,
    );
  }

  return firma;
}
