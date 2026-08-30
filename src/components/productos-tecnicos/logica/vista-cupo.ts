import { formatearBytes, type EstadoCupo } from "@/lib/productos-tecnicos";

/**
 * Cómo se PINTA el cupo. El cálculo del cupo en sí (`estadoCupo`,
 * `formatearBytes`) es del dominio y se reusa tal cual — lo único que se
 * añade aquí es la clasificación en niveles visuales, que no existe en el
 * dominio porque al dominio solo le importa el pase/no-pase (`verificarCupo`
 * lanza 413 o no lanza nada).
 *
 * El cupo se muestra ANTES de que alguien intente subir un archivo que no
 * cabe: un 413 después de esperar la subida es la peor forma de enterarse.
 */

export type NivelCupo = "ok" | "aviso" | "critico";

/** Desde qué porcentaje se avisa y desde cuál se pone en rojo. */
export const UMBRAL_AVISO = 70;
export const UMBRAL_CRITICO = 90;

export interface CupoVista {
  nivel: NivelCupo;
  porcentaje: number;
  usadoLegible: string;
  limiteLegible: string;
  restanteLegible: string;
}

export function nivelDeCupo(porcentaje: number): NivelCupo {
  if (porcentaje >= UMBRAL_CRITICO) return "critico";
  if (porcentaje >= UMBRAL_AVISO) return "aviso";
  return "ok";
}

export function cupoParaPintar(estado: EstadoCupo): CupoVista {
  return {
    nivel: nivelDeCupo(estado.porcentaje),
    porcentaje: estado.porcentaje,
    usadoLegible: formatearBytes(estado.usadoBytes),
    limiteLegible: formatearBytes(estado.limiteBytes),
    restanteLegible: formatearBytes(estado.restanteBytes),
  };
}

/**
 * ¿Un archivo de este tamaño cabe con el cupo que se conoce en el cliente?
 * Es un AVISO temprano, no la última palabra: el rechazo real y definitivo
 * lo hace `verificarCupo()` en el servidor, sobre el cupo real en ese
 * instante (que pudo cambiar si alguien más subió algo mientras tanto).
 */
export function cabeEnCupo(estado: EstadoCupo, bytesArchivo: number): boolean {
  return bytesArchivo <= estado.restanteBytes;
}
