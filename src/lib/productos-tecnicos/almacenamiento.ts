import { randomBytes } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Subida y borrado de los archivos de productos técnicos.
 *
 * Comparte el bucket `evidencias` con el resto del producto —igual que las
 * facturas de gastos— bajo el prefijo `productos-tecnicos/`. Compartirlo es
 * deliberado: `getSignedEvidenciaUrl()` de `src/lib/storage.ts` ya firma URLs
 * de ese bucket, así que la ruta de descarga no necesita nada nuevo.
 *
 * El cliente service-role se construye aquí en vez de reusar el de
 * `src/lib/storage.ts` porque ese archivo es compartido con otros módulos y no
 * lo exporta. La alternativa —añadirle una función— tocaría código del que
 * dependen flujos ya en producción (evidencias del obrero, con cola offline).
 * Diez líneas duplicadas cuestan menos que ese riesgo.
 *
 * Por qué service-role y no la sesión del usuario: el control de acceso ya lo
 * hicieron `requireUser()` + `assertObraAccesible()` antes de llegar aquí, y
 * depender además de las políticas del bucket significaría mantener la misma
 * regla escrita en dos sitios que se pueden desincronizar.
 */

const BUCKET = "evidencias";

function storageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Falta configuración de Storage (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Discriminante del nombre de archivo: momento + azar.
 *
 * El timestamp solo no basta —dos subidas en el mismo milisegundo colisionan y
 * `upsert: false` haría fallar la segunda—, y el azar solo no ordena. Juntos
 * dan un nombre único que además se lee cronológicamente en el bucket.
 */
export function sufijoUnico(): string {
  return `${Date.now()}-${randomBytes(4).toString("hex")}`;
}

/** Sube el archivo. Lanza si Storage rechaza: quien llame decide qué hacer. */
export async function subirProductoTecnico(
  archivo: File | Blob,
  storagePath: string,
  contentType: string,
): Promise<void> {
  const supabase = storageAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, archivo, {
    // El MIME que se manda a Storage es el CANÓNICO, deducido del contenido:
    // si se reenviara el del cliente, un archivo se podría servir después con
    // un Content-Type que no le corresponde.
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
}

/**
 * Borra un objeto del bucket. Solo se usa para limpiar cuando la escritura en
 * base falla DESPUÉS de subir — nunca para borrar una versión anterior, que no
 * se borra jamás.
 */
export async function eliminarObjeto(storagePath: string): Promise<void> {
  const supabase = storageAdmin();
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
