/**
 * Utilidades compartidas para trabajar con registros de Aprobacion.
 *
 * `justificacion_por_item` es un campo Json en la BD (Prisma `Json?`), así que
 * en TS llega como `unknown`. Centralizamos aquí la extracción del motivo de
 * rechazo para que las vistas del obrero, contratista y dashboard muestren
 * exactamente el mismo texto y nunca el JSON crudo.
 */

export function extractMotivo(j: unknown): string | null {
  if (!j) return null;
  if (typeof j === "string") return j;
  if (typeof j === "object") {
    const obj = j as Record<string, unknown>;
    if (typeof obj.motivo === "string") return obj.motivo;
  }
  return null;
}
