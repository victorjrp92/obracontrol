import type { FilaRegistro, RegistroDocumento } from "./tipos";

/**
 * Construcción de la fila que se persiste. Es el guardián de la regla de
 * privacidad y por eso vive separado de la escritura: se puede verificar con
 * casos fijos, sin base de datos.
 */

/**
 * Los ÚNICOS campos que este módulo escribe. La lista es el contrato: si
 * aparece uno más, es un defecto de privacidad, no una mejora.
 */
export const CAMPOS_REGISTRADOS = [
  "folio",
  "hash",
  "tipo",
  "ciudad",
  "nivel",
  "piezas",
  "proyecto_id",
  "constructora_id",
] as const;

/** Normaliza la ciudad para que el agregado no se parta en variantes. */
function normalizarCiudad(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpia = valor.trim().slice(0, 60);
  return limpia.length >= 2 ? limpia : null;
}

/**
 * Campo por campo, NUNCA `...datos`.
 *
 * Un spread es justo el defecto que hay que evitar: por las rutas que llaman a
 * esto viajan objetos con datos sensibles pegados, y bastaría con que alguien
 * pasara el payload entero para que terminaran en la base sin que nadie lo
 * note. Enumerar los campos hace imposible ese accidente.
 */
export function construirFilaRegistro(datos: RegistroDocumento): FilaRegistro {
  return {
    folio: datos.folio,
    hash: datos.hash,
    tipo: datos.tipo,
    ciudad: normalizarCiudad(datos.ciudad),
    nivel: datos.nivel ?? null,
    piezas: datos.piezas ?? null,
    proyecto_id: datos.proyectoId ?? null,
    constructora_id: datos.constructoraId ?? null,
  };
}
