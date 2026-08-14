/**
 * Folio y huella de verificación de los PDF de «Juntos» (acta de
 * documentación de daños y derecho de petición). El folio identifica el
 * documento; el hash SHA-256 del contenido validado + folio permite comprobar
 * después que un PDF corresponde a un contenido concreto (se imprime corto en
 * el pie: «Verificación: <folio> · <hash-corto>»).
 *
 * Nada de esto se persiste: el folio/hash viven solo dentro del PDF generado.
 */
import { createHash, randomBytes } from "crypto";

/** `JT-<AAAAMMDD>-<6 hex>` para el acta; otros prefijos para otros documentos. */
export function generarFolio(prefijo: "JT" | "DP", fecha = new Date()): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${prefijo}-${y}${m}${d}-${randomBytes(3).toString("hex")}`;
}

/** SHA-256 (hex) del contenido serializado + folio. */
export function hashContenido(contenidoSerializado: string, folio: string): string {
  return createHash("sha256").update(contenidoSerializado).update(folio).digest("hex");
}

/** Versión corta para imprimir en el pie (12 hex ≈ 48 bits, suficiente para cotejar). */
export function hashCorto(hashCompleto: string): string {
  return hashCompleto.slice(0, 12);
}
