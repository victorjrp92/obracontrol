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

/**
 * Sube la foto de una FACTURA (módulo de gastos). Reusa el bucket "evidencias"
 * con un prefijo `facturas/` y la misma estrategia service-role que las
 * evidencias de tareas (el control de acceso lo hace la API). Devuelve solo el
 * path — las signed URLs se generan al leer con getSignedEvidenciaUrl.
 */
export async function uploadFacturaFile(
  file: File,
  proyectoId: string,
  userId: string,
): Promise<string> {
  const supabase = storageAdmin();

  if (file.size > MAX_FOTO_SIZE) {
    throw new Error("La foto no puede superar 10 MB");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `facturas/${proyectoId}/${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Error subiendo factura: ${error.message}`);

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

// ─── Borrado ────────────────────────────────────────────────────────────────

/**
 * Forma de una ruta creada por NOSOTROS dentro del bucket. Las tres que
 * existen hoy:
 *
 *   uploadEvidencia      →  {tareaId}/{userId}/{timestamp}.{ext}
 *   uploadFacturaFile    →  facturas/{proyectoId}/{userId}/{timestamp}.{ext}
 *   sugerencias/upload   →  sugerencias/{userId}/{timestamp}.{ext}
 *
 * Se valida la forma ANTES de borrar por una razón concreta: varios campos del
 * esquema guardan «urls» que NO son nuestras (`ExtensionTiempo.documentacion_url`
 * y `Retraso.evidencia_urls` llegan del cuerpo de la petición sin pasar por una
 * ruta de subida, así que pueden ser enlaces externos escritos por el usuario).
 * Borrar por una cadena arbitraria es cómo se termina eliminando el archivo de
 * otro. Si no tiene esta forma, no lo creamos nosotros y no se toca.
 */
const SEGMENTO = /^[A-Za-z0-9_-]{1,64}$/;
const ARCHIVO = /^\d{10,20}\.[A-Za-z0-9]{1,8}$/;

/**
 * Normaliza un valor guardado en base de datos a una ruta del bucket, o
 * `null` si no es una ruta nuestra.
 *
 * Acepta los dos formatos que conviven: la RUTA CRUDA que se guarda hoy, y la
 * URL PÚBLICA completa de los registros antiguos (el bucket era público antes
 * de pasar a signed URLs).
 *
 * Es una función pura para poder verificarla sin red: aquí un error borra
 * archivos ajenos, y eso no se prueba en producción.
 */
export function rutaDeAlmacenamiento(valor: string | null | undefined): string | null {
  if (!valor || typeof valor !== "string") return null;
  let ruta = valor.trim();
  if (!ruta) return null;

  // Formato antiguo: URL pública completa del bucket.
  const marcaPublica = `/storage/v1/object/public/${BUCKET}/`;
  if (ruta.includes(marcaPublica)) {
    ruta = ruta.split(marcaPublica)[1] ?? "";
    // La URL puede traer query string (?t=...) — se descarta.
    ruta = ruta.split("?")[0];
  } else if (/^https?:\/\//i.test(ruta)) {
    // Cualquier otra URL absoluta es de un tercero: no es nuestra, no se borra.
    return null;
  }

  ruta = decodeURIComponent(ruta).replace(/^\/+/, "");
  if (!ruta || ruta.includes("..")) return null;

  const partes = ruta.split("/");

  // Las formas válidas son EXACTAMENTE dos, no un rango:
  //   3 segmentos → evidencias ({tarea}/{usuario}/{archivo}) y sugerencias
  //   4 segmentos → facturas ({proyecto}/{usuario}/{archivo}), y el primero
  //                 tiene que ser literalmente «facturas»
  // Enumerarlas en vez de aceptar «entre 2 y 4» es lo que impide que una ruta
  // inventada con la profundidad correcta pase el filtro.
  const esEvidenciaOSugerencia = partes.length === 3;
  const esFactura = partes.length === 4 && partes[0] === "facturas";
  if (!esEvidenciaOSugerencia && !esFactura) return null;

  if (!ARCHIVO.test(partes[partes.length - 1])) return null;
  for (const p of partes.slice(0, -1)) {
    if (!SEGMENTO.test(p)) return null;
  }
  return ruta;
}

/**
 * Borra archivos del bucket a partir de lo que haya guardado en base de datos.
 * Filtra lo que no es nuestro, deduplica y borra por lotes.
 *
 * NUNCA lanza: quien la llama ya borró las filas y no puede deshacerlas. Un
 * fallo aquí deja archivos huérfanos —exactamente el estado en que estaba todo
 * antes de este arreglo—, que es mucho mejor que reventar la operación.
 *
 * Devuelve cuántos archivos se pidieron borrar, para poder auditarlo.
 */
export async function borrarArchivos(valores: (string | null | undefined)[]): Promise<number> {
  const rutas = [...new Set(valores.map(rutaDeAlmacenamiento).filter((r): r is string => r !== null))];
  if (rutas.length === 0) return 0;

  try {
    const supabase = storageAdmin();
    // Supabase acepta lotes; se parte para no armar peticiones enormes en una
    // obra con cientos de fotos.
    const TAMANO_LOTE = 100;
    for (let i = 0; i < rutas.length; i += TAMANO_LOTE) {
      const lote = rutas.slice(i, i + TAMANO_LOTE);
      const { error } = await supabase.storage.from(BUCKET).remove(lote);
      if (error) {
        // Sin serializar las rutas: llevan ids de tarea y de usuario.
        console.error(`borrarArchivos: falló un lote de ${lote.length} archivos`);
      }
    }
  } catch {
    console.error("borrarArchivos: no se pudo acceder a Storage");
  }
  return rutas.length;
}

/**
 * Borra el archivo de UNA evidencia.
 *
 * Antes extraía la ruta asumiendo una URL pública, y como el bucket pasó a ser
 * privado —y desde entonces se guarda la ruta cruda— el `if (!path) return`
 * la hacía salir sin borrar nada, en silencio. Resultado: borrar una foto
 * eliminaba la fila y dejaba el archivo en el bucket. Ahora acepta los dos
 * formatos.
 */
export async function deleteEvidencia(valor: string) {
  await borrarArchivos([valor]);
}
