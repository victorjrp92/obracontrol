import { createClient } from "@supabase/supabase-js";
import { DocumentoError } from "./fallas";
import {
  carpetaDeFirma,
  extensionCoincideConFormato,
  extensionDeImagen,
  formatoDeFirma,
  normalizarMatricula,
  rutaImagenFirma,
  rutaPerfilFirma,
  BYTES_CABECERA_FIRMA,
  MAX_BYTES_FIRMA,
  PERFIL_VACIO,
  type PerfilFirma,
} from "./perfil-firma";

/**
 * El perfil de firma, contra el bucket privado.
 *
 * Se apoya en el bucket `evidencias`, que ya es privado y ya se sirve con URLs
 * firmadas temporales. Una firma escaneada es un dato sensible de verdad —quien
 * la tenga puede pegarla en cualquier papel— así que no entra en un bucket
 * público ni se sirve por URL permanente, ni siquiera «difícil de adivinar».
 *
 * `perfil.json` guarda la matrícula y la ruta de la imagen. Es la fuente única:
 * leer el perfil es una sola descarga, y no hay que adivinar la extensión con la
 * que se subió la imagen.
 */

const BUCKET = "evidencias";

/**
 * Cliente con llave de servicio, solo en el servidor. Mismo criterio que
 * `src/lib/storage.ts`: el control de acceso lo hace la ruta (sesión del
 * profesional), no las políticas del bucket.
 */
function clienteStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llaveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llaveServicio) {
    throw new Error("Falta configuración de Storage (SUPABASE_SERVICE_ROLE_KEY).");
  }
  return createClient(url, llaveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** El puerto. Inyectable para poder comprobar quien lo consume sin bucket. */
export interface AlmacenPerfilFirma {
  leer(usuarioId: string): Promise<PerfilFirma>;
  guardarImagen(usuarioId: string, archivo: File): Promise<PerfilFirma>;
  guardarMatricula(usuarioId: string, matricula: string): Promise<PerfilFirma>;
  /** URL temporal para pintar la imagen. Nunca una URL permanente. */
  urlImagen(imagenPath: string, segundos?: number): Promise<string | null>;
}

/**
 * Deja el perfil leído del bucket en un estado utilizable.
 *
 * Valida en vez de confiar: aunque solo escriba este módulo, un `imagenPath` que
 * apuntara fuera de la carpeta del profesional serviría para que su documento se
 * firmara con la imagen de otro. Se comprueba, y si no cuadra se ignora.
 */
function sanearPerfil(crudo: unknown, usuarioId: string): PerfilFirma {
  if (!crudo || typeof crudo !== "object") return PERFIL_VACIO;
  const datos = crudo as { matricula?: unknown; imagenPath?: unknown };

  const carpeta = `${carpetaDeFirma(usuarioId)}/`;
  const imagenPath =
    typeof datos.imagenPath === "string" && datos.imagenPath.startsWith(carpeta)
      ? datos.imagenPath
      : null;

  return {
    imagenPath,
    matricula: normalizarMatricula(typeof datos.matricula === "string" ? datos.matricula : null),
  };
}

/**
 * ¿El bucket dice «eso no existe», o dice otra cosa?
 *
 * La diferencia decide un mensaje. Si el perfil todavía no existe, lo correcto
 * es contestar «no has configurado tu firma» y pedirla. Si lo que falló fue la
 * red, las credenciales o el propio Storage, contestar eso mismo sería mandar a
 * alguien a subir otra vez una firma que ya subió, mientras el problema real
 * pasa inadvertido. Un fallo disfrazado de estado vacío es peor que un fallo.
 */
function esNoEncontrado(error: unknown): boolean {
  const err = error as { status?: number; statusCode?: string | number; message?: string };
  const codigo = Number(err?.statusCode ?? err?.status);
  if (codigo === 404 || codigo === 400) return true;
  return /not\s*found|no such|does not exist/i.test(err?.message ?? "");
}

async function leerPerfil(usuarioId: string): Promise<PerfilFirma> {
  const supabase = clienteStorage();
  const { data, error } = await supabase.storage.from(BUCKET).download(rutaPerfilFirma(usuarioId));

  if (error) {
    // Que no exista todavía es lo normal: aún no ha configurado nada.
    if (esNoEncontrado(error)) return PERFIL_VACIO;
    throw new Error(`No se pudo leer el perfil de firma: ${error.message}`);
  }
  if (!data) return PERFIL_VACIO;

  try {
    return sanearPerfil(JSON.parse(await data.text()), usuarioId);
  } catch {
    // El archivo está y no se puede leer: se trata como vacío a propósito.
    // Volver a configurar la firma lo reescribe, y bloquear al profesional por
    // un JSON corrupto no arregla nada.
    console.error("perfil de firma ilegible; se trata como no configurado");
    return PERFIL_VACIO;
  }
}

async function escribirPerfil(usuarioId: string, perfil: PerfilFirma): Promise<PerfilFirma> {
  const supabase = clienteStorage();
  const cuerpo = new Blob([JSON.stringify(perfil)], { type: "application/json" });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(rutaPerfilFirma(usuarioId), cuerpo, { contentType: "application/json", upsert: true });
  if (error) throw new Error(`No se pudo guardar el perfil de firma: ${error.message}`);
  return perfil;
}

export const almacenPerfilFirma: AlmacenPerfilFirma = {
  leer: leerPerfil,

  async guardarImagen(usuarioId: string, archivo: File): Promise<PerfilFirma> {
    if (archivo.size > MAX_BYTES_FIRMA) {
      throw new DocumentoError(
        "SIN_IMAGEN_DE_FIRMA",
        "La imagen de la firma no puede superar 2 MB."
      );
    }

    const declarada = extensionDeImagen(archivo.name, archivo.type);
    if (!declarada) {
      throw new DocumentoError(
        "SIN_IMAGEN_DE_FIRMA",
        "La firma tiene que ser una imagen PNG, JPG o WEBP."
      );
    }

    // Lo declarado no decide: decide el contenido. Los primeros bytes son lo
    // único que no se falsifica sin fabricar el archivo entero.
    const cabecera = new Uint8Array(await archivo.slice(0, BYTES_CABECERA_FIRMA).arrayBuffer());
    const real = formatoDeFirma(cabecera);
    if (!real) {
      throw new DocumentoError(
        "SIN_IMAGEN_DE_FIRMA",
        "Ese archivo no es una imagen PNG, JPG o WEBP."
      );
    }
    if (!extensionCoincideConFormato(declarada, real)) {
      throw new DocumentoError(
        "SIN_IMAGEN_DE_FIRMA",
        `El archivo se envió como «${declarada}» pero su contenido es ${real.mime}.`
      );
    }

    // El perfil previo se lee ANTES de subir nada. Si se leyera después y la
    // lectura fallara, se reescribiría el perfil sin la matrícula: el
    // profesional subiría su firma y perdería su matrícula de paso.
    const previo = await leerPerfil(usuarioId);

    const supabase = clienteStorage();
    // La extensión y el `contentType` salen del CONTENIDO, nunca del cliente:
    // reenviar el suyo dejaba el objeto guardado —y servido— con el tipo que él
    // eligiera, incluido `text/html`.
    const destino = rutaImagenFirma(usuarioId, real.extension);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(destino, archivo, { contentType: real.mime, upsert: true });
    if (error) throw new Error(`No se pudo subir la imagen de la firma: ${error.message}`);

    // Si la anterior tenía otra extensión, la nueva no la habría sobrescrito y
    // quedaría una firma huérfana en el bucket. Se borra.
    if (previo.imagenPath && previo.imagenPath !== destino) {
      await supabase.storage.from(BUCKET).remove([previo.imagenPath]);
    }

    return escribirPerfil(usuarioId, { ...previo, imagenPath: destino });
  },

  async guardarMatricula(usuarioId: string, matricula: string): Promise<PerfilFirma> {
    const limpia = normalizarMatricula(matricula);
    if (!limpia) {
      throw new DocumentoError(
        "SIN_MATRICULA",
        "La matrícula profesional no parece válida. Escríbela como aparece en tu tarjeta."
      );
    }
    const previo = await leerPerfil(usuarioId);
    return escribirPerfil(usuarioId, { ...previo, matricula: limpia });
  },

  async urlImagen(imagenPath: string, segundos = 3600): Promise<string | null> {
    const supabase = clienteStorage();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(imagenPath, segundos);
    if (error || !data) return null;
    return data.signedUrl;
  },
};
