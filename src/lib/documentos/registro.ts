import { prisma } from "@/lib/prisma";
import { construirFilaRegistro } from "./fila-registro";
import type { RegistroDocumento } from "./tipos";

/**
 * Deja constancia de un documento emitido en `documentos_firmables`.
 *
 * Esto es lo que hace que el sello «Verificación: <folio> · <huella>» del pie
 * signifique algo: sin la fila, si una aseguradora llama a preguntar «¿este
 * documento es suyo?», no hay contra qué cotejarlo.
 *
 * BEST-EFFORT, y nunca lanza. Quien llama ya generó el PDF y debe entregarlo
 * pase lo que pase: nadie que acaba de documentar los daños de su casa después
 * de un sismo puede quedarse sin su documento porque la base tuvo un mal
 * minuto. Se pierde la verificación de ese documento, que es un costo mucho
 * menor.
 */
export async function registrarDocumento(datos: RegistroDocumento): Promise<void> {
  try {
    await prisma.documentoFirmable.create({ data: construirFilaRegistro(datos) });
  } catch {
    // Sin serializar nada: por estas rutas viajan datos sensibles del usuario.
    console.error("registrarDocumento: no se pudo dejar constancia del documento");
  }
}
