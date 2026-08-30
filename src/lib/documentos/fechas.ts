/**
 * Fechas de firma, en la zona horaria que importa.
 *
 * Un documento firmado dice una fecha, y esa fecha tiene peso legal: es la que
 * prueba «cuándo». El servidor corre en UTC, y en Colombia (UTC−5) todo lo que
 * se firma después de las 7 de la noche cae ya en el día siguiente en UTC. Con
 * `toISOString()` un acta firmada el lunes por la noche saldría fechada el
 * martes — un error pequeño hasta el día en que la fecha decide algo.
 *
 * Por eso las fechas de firma y de entrega se formatean en `America/Bogota`, sin
 * depender de dónde corra el proceso. El instante que se guarda en la base sigue
 * siendo UTC, como debe ser; lo que se traduce es solo cómo se muestra.
 *
 * `fechaEmision()` (en `cotejo.ts`) NO cambia: su salida está congelada por
 * `scripts/verificar-documentos.ts` porque hay documentos ya emitidos y
 * verificados contra ella.
 */

/** `en-CA` da exactamente `AAAA-MM-DD`, el mismo formato que el resto del módulo. */
const FORMATO_FECHA_COLOMBIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `AAAA-MM-DD` del día en Colombia, corra el servidor donde corra. */
export function fechaEnColombia(instante: Date): string {
  return FORMATO_FECHA_COLOMBIA.format(instante);
}

const FORMATO_MOMENTO_COLOMBIA = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "long",
  timeStyle: "short",
});

/** Fecha y hora legibles, para el pie del documento y la pantalla del cliente. */
export function momentoEnColombia(instante: Date): string {
  return FORMATO_MOMENTO_COLOMBIA.format(instante);
}
