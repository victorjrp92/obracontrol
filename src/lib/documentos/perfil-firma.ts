import { DocumentoError } from "./fallas";

/**
 * El perfil de firma del profesional: su imagen de firma y su matrícula.
 *
 * Se sube UNA VEZ y queda para todos los documentos que emita. La imagen es lo
 * que se estampa en el PDF; la matrícula es lo que se congela en la fila del
 * documento al firmar.
 *
 * DÓNDE VIVE, y por qué así: el esquema de la base está congelado para este
 * trabajo —lo gobierna otro frente— y `usuarios` no tiene columnas para esto.
 * El perfil es un objeto por profesional, se lee en un solo momento (al firmar)
 * y nunca se consulta ni se agrega, así que vive en el bucket privado bajo una
 * ruta derivada del id del usuario. No hace falta una columna para encontrarlo:
 * la ruta ES la clave. El día que se le añadan columnas a `usuarios`, lo único
 * que cambia es `almacen-firma.ts`; nada de lo que hay aquí ni de lo que firma
 * se entera.
 *
 * Este archivo es puro: rutas y validaciones. La entrada y salida del bucket
 * está en `almacen-firma.ts`, detrás de un puerto.
 */

/** Lo que el profesional tiene guardado. Cualquiera de los dos puede faltar. */
export interface PerfilFirma {
  /** Ruta en el bucket privado de la imagen de firma. */
  imagenPath: string | null;
  /** Matrícula profesional VIGENTE. La firmada se congela en el documento. */
  matricula: string | null;
}

export const PERFIL_VACIO: PerfilFirma = { imagenPath: null, matricula: null };

export const MATRICULA_LARGO_MIN = 3;
export const MATRICULA_LARGO_MAX = 40;

/** Formatos que se aceptan como imagen de firma. */
export const EXTENSIONES_FIRMA = ["png", "jpg", "jpeg", "webp"] as const;
export type ExtensionFirma = (typeof EXTENSIONES_FIRMA)[number];

/** 2 MB. Una firma escaneada pesa kilobytes; lo que pase de aquí es otra cosa. */
export const MAX_BYTES_FIRMA = 2 * 1024 * 1024;

/**
 * Forma admisible de un id de usuario dentro de una ruta de bucket.
 *
 * Los ids son `cuid()`, así que esto nunca rechaza uno real. Está por lo otro:
 * el id entra en una ruta, y una ruta construida con texto sin validar es la
 * puerta de un salto de directorio. Aquí se cierra de una vez y para todos los
 * llamadores, en vez de confiar en que cada uno se acuerde.
 */
const FORMA_ID = /^[A-Za-z0-9_-]{8,64}$/;

const RAIZ_FIRMAS = "firmas";

function asegurarId(usuarioId: string): string {
  if (!FORMA_ID.test(usuarioId)) {
    throw new DocumentoError("FUERA_DE_ALCANCE", "Identificador de usuario no utilizable");
  }
  return usuarioId;
}

/** Carpeta del profesional dentro del bucket privado. */
export function carpetaDeFirma(usuarioId: string): string {
  return `${RAIZ_FIRMAS}/${asegurarId(usuarioId)}`;
}

/** Ruta de la imagen de firma. Una sola por profesional: subir otra la sustituye. */
export function rutaImagenFirma(usuarioId: string, extension: ExtensionFirma): string {
  return `${carpetaDeFirma(usuarioId)}/firma.${extension}`;
}

/** Ruta del resto del perfil (hoy, la matrícula). */
export function rutaPerfilFirma(usuarioId: string): string {
  return `${carpetaDeFirma(usuarioId)}/perfil.json`;
}

/**
 * Extensión válida a partir del tipo declarado y de la ruta del archivo subido.
 * Devuelve `null` si no es una imagen de las admitidas — y entonces no se sube.
 *
 * OJO: esto mira lo que DECLARA quien sube, y las dos cosas que mira —el nombre
 * y el `Content-Type`— las escribe él. Ya no decide nada por sí sola: la familia
 * real la fija `formatoDeFirma()` sobre los primeros bytes, y esta función queda
 * para detectar la CONTRADICCIÓN entre lo declarado y lo que el archivo es.
 */
export function extensionDeImagen(archivo: string, mime: string): ExtensionFirma | null {
  const porMime = mime.toLowerCase().replace("image/", "").replace("jpg", "jpeg");
  const sufijo = archivo.toLowerCase().split(".").pop() ?? "";
  const candidata = EXTENSIONES_FIRMA.find((e) => e === porMime || e === sufijo);
  return candidata ?? null;
}

/**
 * ─── Qué es de verdad la imagen de firma ────────────────────────────────────
 *
 * Una firma escaneada acaba en el bucket y se sirve después por URL firmada. Si
 * el `Content-Type` con el que se guarda saliera de quien sube, bastaría con
 * mandar un HTML llamado `firma.png` declarándolo `text/html` para que el objeto
 * quedara almacenado —y servido— como página: `extensionDeImagen` lo daba por
 * bueno porque el SUFIJO decía `png`, y el `contentType` que iba a Storage era
 * el del cliente. El nombre y el `Content-Type` los escribe quien sube; los
 * primeros bytes, no.
 *
 * Mismo criterio, y a propósito la misma forma, que
 * `src/lib/productos-tecnicos/formatos.ts`. Se repite aquí en vez de importarlo
 * porque aquel módulo arrastra el enum `TipoProductoTecnico` y su propio tipo de
 * error, y `@/lib/documentos` es infraestructura compartida que no debe depender
 * de una línea de producto.
 */

/** Formato REAL de la imagen: con qué extensión se guarda y con qué MIME. */
export interface FormatoFirma {
  extension: ExtensionFirma;
  /** MIME canónico. Es el que va a Storage, nunca el del cliente. */
  mime: string;
}

/**
 * Bytes que hay que leer del principio. El más exigente es WEBP, que necesita
 * llegar al byte 12 (`RIFF....WEBP`); se leen 16 por holgura.
 */
export const BYTES_CABECERA_FIRMA = 16;

function coincideEn(cabecera: Uint8Array, desde: number, patron: readonly number[]): boolean {
  if (cabecera.length < desde + patron.length) return false;
  for (let i = 0; i < patron.length; i++) {
    if (cabecera[desde + i] !== patron[i]) return false;
  }
  return true;
}

interface FirmaMagica extends FormatoFirma {
  /** Extensiones que un archivo de este formato puede llevar legítimamente. */
  alias: readonly ExtensionFirma[];
  coincide(cabecera: Uint8Array): boolean;
}

const FIRMAS_MAGICAS: readonly FirmaMagica[] = [
  {
    extension: "png",
    mime: "image/png",
    alias: ["png"],
    // \x89PNG\r\n\x1a\n
    coincide: (c) => coincideEn(c, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    extension: "jpg",
    mime: "image/jpeg",
    alias: ["jpg", "jpeg"],
    // SOI + primer marcador
    coincide: (c) => coincideEn(c, 0, [0xff, 0xd8, 0xff]),
  },
  {
    extension: "webp",
    mime: "image/webp",
    alias: ["webp"],
    // "RIFF" ....(tamaño).... "WEBP" — hay que mirar las DOS mitades: solo
    // "RIFF" también lo cumplen un .wav y un .avi.
    coincide: (c) =>
      coincideEn(c, 0, [0x52, 0x49, 0x46, 0x46]) && coincideEn(c, 8, [0x57, 0x45, 0x42, 0x50]),
  },
];

/** Qué es la imagen según sus primeros bytes. `null` si no es ninguna admitida. */
export function formatoDeFirma(cabecera: Uint8Array): FormatoFirma | null {
  const firma = FIRMAS_MAGICAS.find((f) => f.coincide(cabecera));
  return firma ? { extension: firma.extension, mime: firma.mime } : null;
}

/**
 * ¿La extensión declarada es compatible con el formato real? `jpg` y `jpeg` son
 * la misma cosa; cualquier otra pareja es una contradicción y se rechaza.
 */
export function extensionCoincideConFormato(
  declarada: ExtensionFirma,
  real: FormatoFirma
): boolean {
  const firma = FIRMAS_MAGICAS.find((f) => f.extension === real.extension);
  return firma ? firma.alias.includes(declarada) : false;
}

/**
 * Deja la matrícula como se va a imprimir. Devuelve `null` si lo que llega no
 * sirve como matrícula, que no es lo mismo que una cadena vacía: `null` significa
 * «este profesional todavía no la registró» y bloquea la firma.
 */
export function normalizarMatricula(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpia = valor.trim().replace(/\s+/g, " ");
  if (limpia.length < MATRICULA_LARGO_MIN || limpia.length > MATRICULA_LARGO_MAX) return null;
  return limpia;
}
