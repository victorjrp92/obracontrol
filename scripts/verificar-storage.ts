/**
 * Verificación de `rutaDeAlmacenamiento` en `src/lib/storage.ts`.
 * TypeScript puro, sin red: no toca Storage ni la base de datos.
 *
 * POR QUÉ EXISTE: esta función decide QUÉ ARCHIVO SE BORRA. Un error aquí no
 * da un error en pantalla — elimina el archivo de otra obra, o el de otro
 * cliente, y eso no se deshace. Es exactamente el tipo de código que no se
 * prueba en producción.
 *
 * Dos fallos concretos que cubre:
 *
 *  1. `deleteEvidencia` extraía la ruta asumiendo una URL pública. Cuando el
 *     bucket pasó a privado y se empezó a guardar la ruta cruda, la función
 *     salía sin borrar EN SILENCIO: se borraba la fila y el archivo se quedaba.
 *  2. Varios campos del esquema guardan «urls» que no son nuestras
 *     (`ExtensionTiempo.documentacion_url`, `Retraso.evidencia_urls` llegan del
 *     cuerpo de la petición). Borrar por una cadena arbitraria es cómo se
 *     termina eliminando lo que no era tuyo.
 *
 * Uso: npm run verify:storage
 */
import { rutaDeAlmacenamiento } from "../src/lib/storage";

let ok = 0;
let fallos = 0;

function comprobar(nombre: string, condicion: boolean, detalle?: string) {
  if (condicion) {
    ok++;
    console.log(`  OK   ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n${titulo}`);
}

function acepta(valor: string, esperado: string) {
  const r = rutaDeAlmacenamiento(valor);
  comprobar(`acepta: ${valor.slice(0, 58)}`, r === esperado, `obtuvo ${r ?? "null"}`);
}

function rechaza(valor: string | null | undefined, motivo: string) {
  const r = rutaDeAlmacenamiento(valor);
  comprobar(`rechaza (${motivo}): ${String(valor).slice(0, 44)}`, r === null, `obtuvo ${r}`);
}

// ─── 1. Las tres formas que creamos nosotros ────────────────────────────────
seccion("1) Rutas que SÍ son nuestras");

// uploadEvidencia → {tareaId}/{userId}/{timestamp}.{ext}
acepta("ckt4rea0000abcdef/ckuser0000abcdef/1755000000000.jpg", "ckt4rea0000abcdef/ckuser0000abcdef/1755000000000.jpg");
acepta("ckt4rea0000abcdef/ckuser0000abcdef/1755000000000.mp4", "ckt4rea0000abcdef/ckuser0000abcdef/1755000000000.mp4");
// uploadFacturaFile → facturas/{proyectoId}/{userId}/{timestamp}.{ext}
acepta("facturas/ckproy1/ckuser1/1755000000000.pdf", "facturas/ckproy1/ckuser1/1755000000000.pdf");
// sugerencias/upload → sugerencias/{userId}/{timestamp}.{ext}
acepta("sugerencias/ckuser1/1755000000000.png", "sugerencias/ckuser1/1755000000000.png");

// ─── 2. El formato antiguo sigue funcionando ────────────────────────────────
seccion("2) URLs públicas de los registros antiguos");

acepta(
  "https://abc.supabase.co/storage/v1/object/public/evidencias/ckt4rea1/ckuser1/1755000000000.jpg",
  "ckt4rea1/ckuser1/1755000000000.jpg"
);
// Con query string, como las devolvía la API pública.
acepta(
  "https://abc.supabase.co/storage/v1/object/public/evidencias/ckt4rea1/ckuser1/1755000000000.jpg?t=123",
  "ckt4rea1/ckuser1/1755000000000.jpg"
);

// ─── 3. Lo que NUNCA se debe borrar ─────────────────────────────────────────
seccion("3) Lo que no es nuestro: no se toca");

// El fallo con más consecuencias: intentar borrar por una URL de un tercero.
rechaza("https://drive.google.com/file/d/abc123/view", "enlace externo");
rechaza("https://ejemplo.com/plano.pdf", "enlace externo");
rechaza("http://192.168.1.10/archivo.jpg", "enlace externo");
// Otro bucket del mismo proyecto de Supabase: los avatares NO se borran al
// eliminar una obra.
rechaza("https://abc.supabase.co/storage/v1/object/public/avatars/ckuser1/1755000000000.jpg", "otro bucket");
// Texto libre que alguien escribió en un campo de documentación.
rechaza("pendiente de subir", "texto libre");
rechaza("N/A", "texto libre");

seccion("4) Travesía de rutas y formas inválidas");

rechaza("../../otro-bucket/secreto.jpg", "intento de salir del bucket");
rechaza("ckt4rea1/../ckotro/1755000000000.jpg", "travesía en medio");
rechaza("/ckt4rea1/ckuser1/1755000000000.jpg".replace(/^\//, "..//"), "travesía disfrazada");
rechaza("1755000000000.jpg", "sin carpeta: no tiene la forma");
rechaza("a/b/c/d/1755000000000.jpg", "4 niveles sin el prefijo facturas");
rechaza("a/b/c/d/e/1755000000000.jpg", "demasiados niveles");
rechaza("ckuser1/1755000000000.jpg", "solo 2 niveles: no es ninguna forma nuestra");
rechaza("ckt4rea1/ckuser1/archivo.jpg", "el archivo no es una marca de tiempo");
rechaza("ckt4rea1/ckuser1/1755000000000", "sin extensión");
rechaza("ckt4rea1/ck user1/1755000000000.jpg", "espacio en el segmento");
rechaza("ckt4rea1/ck;rm -rf/1755000000000.jpg", "caracteres no permitidos");

seccion("5) Vacíos y basura");

rechaza("", "cadena vacía");
rechaza("   ", "solo espacios");
rechaza(null, "null");
rechaza(undefined, "undefined");

// ─── 6. Idempotencia ────────────────────────────────────────────────────────
seccion("6) Una ruta ya normalizada no cambia al volver a pasarla");

const yaLimpia = "ckt4rea1/ckuser1/1755000000000.jpg";
comprobar(
  "normalizar dos veces da lo mismo",
  rutaDeAlmacenamiento(rutaDeAlmacenamiento(yaLimpia)) === yaLimpia
);

// ─── 7. La barrida de seguridad ─────────────────────────────────────────────
seccion("7) Barrida: nada fuera de forma se cuela");

const NUNCA_BORRABLES = [
  "https://drive.google.com/x",
  "https://www.dropbox.com/s/x/plano.pdf",
  "https://abc.supabase.co/storage/v1/object/public/avatars/u/1755000000000.jpg",
  "https://abc.supabase.co/storage/v1/object/sign/evidencias/a/b/1.jpg",
  "../secreto",
  "a/../../b/1755000000000.jpg",
  "",
  "   ",
  "sin ruta",
];
const coladas = NUNCA_BORRABLES.filter((v) => rutaDeAlmacenamiento(v) !== null);
comprobar(
  "ninguna cadena que no sea nuestra devuelve una ruta borrable",
  coladas.length === 0,
  coladas.join(" | ")
);

console.log(`\n${ok}/${ok + fallos} verificaciones OK`);
if (fallos > 0) {
  console.error(`${fallos} FALLARON — NO desplegar: el borrado puede eliminar archivos ajenos.`);
  process.exit(1);
}
console.log("Derivación de rutas de Storage verificada sin errores.");
