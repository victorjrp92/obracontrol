import { generarFolio as generarFolioVerificable, type PrefijoFolio } from "@/lib/documentos/folio";

/**
 * Folio y huella de los PDF de «Juntos».
 *
 * Capa fina sobre `@/lib/documentos`: el algoritmo vive allí y esta línea solo
 * declara cuáles son SUS prefijos. La API no cambió, así que las rutas de PDF
 * siguen importando de aquí sin enterarse.
 */

/** `JT` para el acta y el informe de grietas; `DP` para el derecho de petición. */
type PrefijoJuntos = Extract<PrefijoFolio, "JT" | "DP">;

export function generarFolio(prefijo: PrefijoJuntos, fecha = new Date()): string {
  return generarFolioVerificable(prefijo, fecha);
}

export { hashContenido, hashCorto } from "@/lib/documentos/folio";
