import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const BUCKET = "evidencias";
const MAX_FOTO_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Cliente de Storage con llave de servicio (service-role). Se usa SOLO en el
 * servidor. El control de acceso ya se hace en cada API (sesión del admin o
 * token del obrero), por lo que evitamos depender de las políticas RLS del
 * bucket — clave para que el OBRERO (que no tiene sesión de Supabase) pueda
 * subir sus fotos sin que RLS lo bloquee.
 */
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

export async function uploadEvidencia(
  file: File,
  tareaId: string,
  userId: string,
  tipo: "FOTO" | "VIDEO"
): Promise<string> {
  const supabase = storageAdmin();

  const maxSize = tipo === "FOTO" ? MAX_FOTO_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    throw new Error(
      tipo === "FOTO"
        ? "La foto no puede superar 10 MB"
        : "El video no puede superar 50 MB"
    );
  }

  const ext = file.name.split(".").pop() ?? (tipo === "FOTO" ? "jpg" : "mp4");
  const path = `${tareaId}/${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Error subiendo archivo: ${error.message}`);

  // Guardamos solo el path — generamos signed URLs al leer
  return path;
}

// Genera una signed URL temporal para visualizar una evidencia
export async function getSignedEvidenciaUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = storageAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    console.error("Error creando signed URL:", error);
    return "";
  }
  return data.signedUrl;
}

export async function deleteEvidencia(url: string) {
  const supabase = storageAdmin();
  // Extrae el path desde la URL pública
  const path = url.split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}
