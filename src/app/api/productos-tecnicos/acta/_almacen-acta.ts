import { createClient } from "@supabase/supabase-js";

/**
 * Dónde queda congelado el contenido de un acta ya emitida, y cómo se leen las
 * fotos para imprimirlo.
 *
 * POR QUÉ HAY QUE CONGELARLO. La huella del folio se calcula sobre el contenido
 * serializado en el momento de emitir. Si el PDF se reconstruyera después
 * consultando la base, bastaría con que alguien corrigiera la dirección del
 * inmueble o renombrara un espacio para que el documento reimpreso dejara de
 * cotejar contra su propia huella —y el sello del pie diría «este contenido
 * cambió» sobre un acta que nadie tocó. Así que el contenido se guarda tal cual,
 * byte por byte, y el PDF se imprime SIEMPRE desde esa copia.
 *
 * POR QUÉ EN STORAGE Y NO EN UNA COLUMNA. `prisma/` está congelado para este
 * trabajo y `documentos_firmables` no tiene dónde guardar un documento entero.
 * Es el mismo caso —y la misma solución— que el perfil de firma de leaf-4.2: un
 * objeto por documento, que se escribe una vez y se lee por una ruta derivada
 * de sus identificadores. La ruta ES la clave; no hace falta una columna para
 * encontrarlo. El día que el modelo tenga una columna, lo único que cambia es
 * este archivo.
 *
 * Se escribe con `upsert: false`: una copia congelada que se pudiera sobrescribir
 * no estaría congelada. Corregir un acta emite otra, con su folio y su copia.
 */

const BUCKET = "evidencias";
const PREFIJO = "actas-estado-inicial";

/** Solo lo que no puede escaparse de su carpeta. Mismo criterio que `ruta.ts`. */
function segmentoSeguro(valor: string): string {
  return valor.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/** `actas-estado-inicial/<obra>/<folio>.json`. */
export function rutaSnapshot(proyectoId: string, folio: string): string {
  return `${PREFIJO}/${segmentoSeguro(proyectoId)}/${segmentoSeguro(folio)}.json`;
}

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Falta configuración de Storage (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * La copia congelada de un acta.
 *
 * `contenido` es la cadena EXACTA que se resumió en la huella — no el objeto,
 * la cadena: reserializar un objeto es la forma más fácil de cambiar un byte sin
 * darse cuenta. `rutas` mapea cada foto a su objeto en el bucket, para que
 * imprimir no dependa de que las filas sigan diciendo lo mismo.
 */
export interface SnapshotActa {
  version: 1;
  folio: string;
  contenido: string;
  rutas: Record<string, string>;
}

export async function guardarSnapshotActa(
  proyectoId: string,
  snapshot: SnapshotActa,
): Promise<void> {
  const supabase = storageAdmin();
  const cuerpo = new Blob([JSON.stringify(snapshot)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(rutaSnapshot(proyectoId, snapshot.folio), cuerpo, {
      contentType: "application/json",
      upsert: false,
    });
  if (error) throw new Error(`No se pudo guardar el contenido del acta: ${error.message}`);
}

/** La copia congelada, o `null` si no está. */
export async function leerSnapshotActa(
  proyectoId: string,
  folio: string,
): Promise<SnapshotActa | null> {
  const supabase = storageAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(rutaSnapshot(proyectoId, folio));
  if (error || !data) return null;

  try {
    const crudo = JSON.parse(await data.text()) as SnapshotActa;
    if (crudo?.version !== 1 || typeof crudo.contenido !== "string") return null;
    return { version: 1, folio: crudo.folio, contenido: crudo.contenido, rutas: crudo.rutas ?? {} };
  } catch {
    return null;
  }
}

/**
 * Los únicos formatos que react-pdf sabe dibujar.
 *
 * No es una preferencia: `<Image>` de react-pdf decodifica JPEG y PNG, y con
 * cualquier otra cosa LANZA. Un WEBP —que el módulo admite como imagen de firma—
 * no tumbaría una foto, tumbaría la generación del acta entera. Se filtra aquí,
 * en el único punto por el que entran imágenes al documento.
 */
const MIMES_IMPRIMIBLES = ["image/jpeg", "image/png"];

/**
 * Una imagen del bucket, como data-URI, que es lo que `<Image src>` de react-pdf
 * consume sin depender del host ni de una URL que caduque a mitad del render.
 *
 * `null` si el objeto no está o si su formato no se puede dibujar: una imagen
 * que falte deja un hueco en el acta, que es mucho menos grave que no poder
 * imprimir el documento.
 */
export async function fotoComoDataUrl(storagePath: string): Promise<string | null> {
  const supabase = storageAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) return null;

  // El tipo que declara Storage puede venir vacío. Las fotos del registro son
  // siempre JPEG (salen del `canvas` de la cámara), así que ese es el supuesto
  // razonable cuando no hay tipo; lo que no se admite es dibujar a ciegas algo
  // que dice ser otra cosa.
  const mime = data.type?.toLowerCase() || "image/jpeg";
  if (!MIMES_IMPRIMIBLES.includes(mime)) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
