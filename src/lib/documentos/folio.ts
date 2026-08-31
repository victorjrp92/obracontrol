/**
 * Folio y huella de los documentos verificables de Seiricon.
 *
 * El folio identifica el documento; la huella SHA-256 del contenido validado +
 * el folio permite comprobar después que un PDF corresponde a un contenido
 * concreto. Los dos se imprimen en el pie: «Verificación: <folio> · <huella>».
 *
 * ALGORITMO CONGELADO. Hay documentos emitidos, descargados y entregados a
 * aseguradoras con estos valores impresos encima. Cambiar cualquier detalle
 * —el orden de los `update()`, meter un separador, mover la longitud del corto,
 * pasar la fecha a UTC— dejaría de verificar papeles que ya están en manos de
 * gente. `scripts/verificar-documentos.ts` congela los valores esperados: si
 * alguien toca esto, ese script falla antes que un usuario.
 */
import { createHash, randomBytes } from "crypto";

/**
 * Prefijo de dos letras que abre el folio y dice de qué familia es el
 * documento. Esto es un REGISTRO: cada línea de producto declara el suyo aquí y
 * no en su propio módulo, que es lo único que evita que dos familias se peleen
 * el mismo código.
 *
 *   JT — acta de daños e informe de grietas  (línea Juntos)
 *   DP — derecho de petición                 (línea Juntos)
 *   AE — acta de estado inicial              (línea Arquitecto)
 *   CT — concepto técnico                    (línea Arquitecto)
 *   CZ — cotización                          (línea Arquitecto)
 *
 * `CT` no es un capricho de dos letras: el documento se llama «concepto
 * técnico» en cada pantalla y en cada pie de página, y el folio impreso lo dice
 * también. La base guarda el valor `INFORME_TECNICO` porque así lo fijó la
 * migración, pero nadie fuera del esquema lee ese nombre.
 */
export type PrefijoFolio = "JT" | "DP" | "AE" | "CT" | "CZ";

/** Todos los prefijos declarados. Sirve para reconocer un folio propio. */
export const PREFIJOS: readonly PrefijoFolio[] = ["JT", "DP", "AE", "CT", "CZ"];

/** Forma de todo folio: `<2 mayúsculas>-<AAAAMMDD>-<6 hex en minúscula>`. */
export const PATRON_FOLIO = /^[A-Z]{2}-\d{8}-[0-9a-f]{6}$/;

/** Huella que se acepta para cotejar: de la corta impresa (12) al SHA-256 entero (64). */
export const PATRON_HUELLA = /^[0-9a-f]{8,64}$/;

/** Cuántos hex del SHA-256 se imprimen en el pie del documento. */
export const LARGO_HUELLA_CORTA = 12;

/** `JT-<AAAAMMDD>-<6 hex>`. La parte aleatoria son 3 bytes de `randomBytes`. */
export function generarFolio(prefijo: PrefijoFolio, fecha = new Date()): string {
  // Fecha LOCAL a propósito: quien lee el folio está en Colombia y tiene que
  // ver el mismo día que dice su documento, no el día en UTC.
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${prefijo}-${y}${m}${d}-${randomBytes(3).toString("hex")}`;
}

/** SHA-256 (hex) del contenido serializado + folio. */
export function hashContenido(contenidoSerializado: string, folio: string): string {
  return createHash("sha256").update(contenidoSerializado).update(folio).digest("hex");
}

/** Versión corta para el pie (12 hex ≈ 48 bits, suficiente para cotejar). */
export function hashCorto(hashCompleto: string): string {
  return hashCompleto.slice(0, LARGO_HUELLA_CORTA);
}

/**
 * Deja el folio exactamente como lo escribe `generarFolio()`: prefijo en
 * MAYÚSCULA y la parte aleatoria en minúscula (`randomBytes(3).toString("hex")`).
 *
 * Hace falta porque la persona lo copia a mano del pie de un PDF y puede
 * escribirlo como sea. Pasarlo todo a mayúsculas —el error original— hacía que
 * NINGÚN folio válido pasara el filtro: el hex quedaba en mayúscula y el patrón
 * solo acepta minúscula.
 */
export function normalizarFolio(crudo: string): string {
  const partes = crudo.trim().split("-");
  if (partes.length !== 3) return crudo.trim();
  return `${partes[0].toUpperCase()}-${partes[1]}-${partes[2].toLowerCase()}`;
}

/**
 * ¿Es un folio bien formado y de alguna de estas familias?
 *
 * Cada pantalla de verificación pasa SOLO los prefijos que le competen: la de
 * Juntos no tiene por qué responder por un documento del arquitecto, ni al
 * revés.
 */
export function esFolioDeFamilia(folio: string, prefijos: readonly PrefijoFolio[]): boolean {
  return PATRON_FOLIO.test(folio) && prefijos.some((p) => folio.startsWith(`${p}-`));
}

/**
 * De qué familia es un folio ya emitido.
 *
 * Hace falta para corregir: la versión nueva de un documento tiene que llevar el
 * MISMO prefijo que la anterior —una corrección de un acta de estado inicial
 * sigue siendo un acta de estado inicial— y la única fuente fiable de esa
 * familia es el folio que el documento ya tiene impreso. Devuelve `null` si el
 * folio no está bien formado o si su prefijo no está declarado arriba.
 */
export function prefijoDeFolio(folio: string): PrefijoFolio | null {
  if (!PATRON_FOLIO.test(folio)) return null;
  const prefijo = folio.slice(0, 2);
  return PREFIJOS.find((p) => p === prefijo) ?? null;
}
