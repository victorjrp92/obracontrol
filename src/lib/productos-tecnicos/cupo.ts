import { fallar } from "./errores";
import type { EstadoCupo, ProductoConPeso } from "./tipos";

/**
 * Cupo de almacenamiento por obra.
 *
 * 1 GB por obra. La referencia: un proyecto real de arquitecto —registro
 * fotográfico completo, planos y renders— pesa alrededor de 262 MB. El tope
 * deja cuatro veces ese margen porque no está para racionar disco, está para
 * que nadie use una obra como disco duro gratis.
 *
 * LA PARTE QUE SE OLVIDA: lo consumido incluye las versiones REEMPLAZADAS. Un
 * plano nunca se borra —el histórico es lo que permite demostrar qué se
 * entregó y cuándo—, así que la versión 1 sigue ocupando exactamente lo mismo
 * después de subir la versión 2. Contar solo las vigentes daría un cupo que
 * crece solo, y la obra se pasaría del límite real sin que nadie lo viera.
 */

/** 1 GB (1024³). */
export const CUPO_BYTES_POR_OBRA = 1024 * 1024 * 1024;

/**
 * Tope por archivo suelto.
 *
 * No es una regla de negocio, es la realidad del transporte: la subida pasa
 * por una función serverless y el cuerpo de la petición tiene que caber en
 * memoria para poder mirarle los primeros bytes antes de aceptarlo. Si algún
 * día hace falta subir planos más pesados, el cambio no es subir este número
 * sino mover la subida a una URL firmada y sniffear la cabecera desde storage.
 */
export const MAX_BYTES_POR_ARCHIVO = 50 * 1024 * 1024;

/**
 * Suma el peso de TODOS los productos de una obra.
 *
 * Recibe `vigente` en cada fila y lo ignora deliberadamente: la firma existe
 * para que se vea que el filtro no está, no porque falte. Quien la cambie para
 * filtrar por vigencia estará rompiendo el cupo a propósito.
 */
export function bytesOcupados(productos: readonly ProductoConPeso[]): number {
  return productos.reduce((suma, p) => suma + p.bytes, 0);
}

/** Cómo está el cupo de una obra que ya lleva `usadoBytes` ocupados. */
export function estadoCupo(usadoBytes: number): EstadoCupo {
  const usado = Math.max(0, usadoBytes);
  const restante = Math.max(0, CUPO_BYTES_POR_OBRA - usado);
  return {
    limiteBytes: CUPO_BYTES_POR_OBRA,
    usadoBytes: usado,
    restanteBytes: restante,
    porcentaje: Math.min(100, Math.round((usado / CUPO_BYTES_POR_OBRA) * 100)),
  };
}

/**
 * ¿Cabe `entranteBytes` en la obra? Devuelve el cupo YA CONTANDO el archivo
 * nuevo; lanza 413 con lo que queda si no cabe.
 *
 * El mensaje dice cuánto queda libre a propósito: «no cabe» a secas obliga a
 * quien sube a adivinar si le sobran 2 MB o 200.
 */
export function verificarCupo(usadoBytes: number, entranteBytes: number): EstadoCupo {
  const actual = estadoCupo(usadoBytes);

  if (entranteBytes > actual.restanteBytes) {
    fallar(
      413,
      "CUPO_EXCEDIDO",
      `Esta obra llegó a su cupo de ${formatearBytes(CUPO_BYTES_POR_OBRA)}. ` +
        `Quedan ${formatearBytes(actual.restanteBytes)} libres y el archivo pesa ` +
        `${formatearBytes(entranteBytes)}.`,
    );
  }

  return estadoCupo(usadoBytes + entranteBytes);
}

/** Tope por archivo. Lanza 413 si se pasa. */
export function verificarTamanoArchivo(bytes: number): void {
  if (!Number.isFinite(bytes) || !Number.isInteger(bytes) || bytes <= 0) {
    fallar(400, "ENTRADA_INVALIDA", "El archivo llegó vacío o con un tamaño inválido.");
  }
  if (bytes > MAX_BYTES_POR_ARCHIVO) {
    fallar(
      413,
      "ARCHIVO_DEMASIADO_GRANDE",
      `Cada archivo puede pesar hasta ${formatearBytes(MAX_BYTES_POR_ARCHIVO)}; este pesa ${formatearBytes(bytes)}.`,
    );
  }
}

/**
 * Bytes en algo que una persona pueda leer. Sin `toLocaleString`: el mensaje
 * viaja en la respuesta de la API y tiene que salir igual en cualquier máquina.
 */
export function formatearBytes(bytes: number): string {
  const abs = Math.max(0, bytes);
  if (abs >= 1024 * 1024 * 1024) return `${recortar(abs / (1024 * 1024 * 1024))} GB`;
  if (abs >= 1024 * 1024) return `${recortar(abs / (1024 * 1024))} MB`;
  if (abs >= 1024) return `${recortar(abs / 1024)} KB`;
  return `${abs} bytes`;
}

function recortar(valor: number): string {
  const redondeado = Math.round(valor * 10) / 10;
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1);
}
