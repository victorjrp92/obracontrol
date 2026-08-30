import type { TipoDocumentoFirmable } from "@/generated/prisma";
import { fechaEnColombia } from "./fechas";
import type { Hallazgo } from "./tipos";

/**
 * De una fila de `documentos_firmables` a lo que la verificación pública
 * responde. Puro a propósito: es la pieza que decide qué sale y qué no, y tiene
 * que poder comprobarse con casos fijos, sin base de datos.
 *
 * Las dos claves nuevas —`firmas` y `vigencia`— se OMITEN cuando no aportan
 * nada. Un documento sin firmar y en su primera versión responde exactamente lo
 * que respondía antes de que existieran las firmas, clave por clave y en el
 * mismo orden. No es elegancia: hay documentos ya emitidos que se verifican
 * contra esa forma y `scripts/verificar-documentos.ts` la tiene congelada.
 */
export interface FilaVerificable {
  tipo: TipoDocumentoFirmable;
  hash: string;
  created_at: Date;
  firmado_el: Date | null;
  matricula: string | null;
  recibido_el: Date | null;
  version: number;
  /** ¿Existe una versión posterior que señala a esta? */
  reemplazado: boolean;
}

export function hallazgoDeFila(fila: FilaVerificable | null): Hallazgo {
  if (!fila) return { estado: "ausente" };

  const llevaFirma = fila.firmado_el !== null || fila.recibido_el !== null;
  const enCadena = fila.version > 1 || fila.reemplazado;

  return {
    estado: "encontrado",
    documento: {
      tipo: fila.tipo,
      hash: fila.hash,
      emitido: fila.created_at,
      ...(llevaFirma
        ? {
            firmas: {
              profesional: fila.firmado_el
                ? { fecha: fechaEnColombia(fila.firmado_el), matricula: fila.matricula }
                : null,
              recibido: fila.recibido_el ? { fecha: fechaEnColombia(fila.recibido_el) } : null,
            },
          }
        : {}),
      ...(enCadena ? { vigencia: { version: fila.version, reemplazado: fila.reemplazado } } : {}),
    },
  };
}
