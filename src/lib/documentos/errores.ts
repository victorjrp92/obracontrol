/**
 * ¿El error de Prisma viene de que la tabla todavía no existe?
 *
 * Importa distinguirlo de «no encontré el folio»: si la migración aún no se
 * aplicó, responder «no encontramos este folio» sería mentir — el documento
 * puede ser perfectamente auténtico. Postgres devuelve 42P01 para «relation
 * does not exist»; Prisma lo pasa como P2021 («table does not exist»).
 */
export function esTablaInexistente(err: unknown): boolean {
  const codigo = (err as { code?: string })?.code;
  return codigo === "P2021" || codigo === "42P01";
}
