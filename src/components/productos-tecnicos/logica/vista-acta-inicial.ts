/**
 * Un acta ya emitida, tal como la ve el profesional en su pantalla.
 *
 * Es una proyección, no la fila: de `documentos_firmables` solo sale lo que
 * hace falta para decidir qué se puede hacer con el acta —imprimirla, firmarla,
 * corregirla— y para leer el sello que lleva impreso. Los ids de tenant y de
 * usuario no viajan al navegador porque el navegador no tiene nada que hacer
 * con ellos.
 *
 * Módulo puro: sin React, sin red, sin Prisma.
 */

export interface ActaEnPantalla {
  id: string;
  folio: string;
  /** Los 12 hex del pie del PDF. Sirve para cotejar sin abrir el documento. */
  huellaCorta: string;
  version: number;
  /** `AAAA-MM-DD` en la zona de Colombia. */
  emitidaEl: string;
  /** Fecha y hora legibles de la firma del profesional. `null` si está sin firmar. */
  firmadoMomento: string | null;
  /** La matrícula congelada al firmar, no la del perfil de hoy. */
  matricula: string | null;
  /** Cuándo dejó el cliente su constancia de entrega. */
  recibidoMomento: string | null;
  /** ¿Existe una versión posterior que la corrige? */
  reemplazada: boolean;
}

/** Las tres etapas por las que pasa un acta, en el orden en que ocurren. */
export type EtapaActa = "BORRADOR" | "FIRMADA" | "ENTREGADA";

export function etapaDe(acta: ActaEnPantalla): EtapaActa {
  if (acta.recibidoMomento) return "ENTREGADA";
  if (acta.firmadoMomento) return "FIRMADA";
  return "BORRADOR";
}

/**
 * Qué significa cada etapa, dicho sin adornos.
 *
 * «Entregada» y no «aprobada»: la constancia del cliente es de ENTREGA. Llamarla
 * aprobación aquí sería contradecir, en la pantalla del profesional, lo que la
 * pantalla del cliente le explicó al cliente.
 */
export const ETIQUETA_ETAPA: Record<EtapaActa, string> = {
  BORRADOR: "Sin firmar",
  FIRMADA: "Firmada",
  ENTREGADA: "Entregada al cliente",
};

/**
 * La versión vigente de la cadena: la más alta que nadie ha reemplazado.
 * `null` si todavía no hay ninguna. Es la que se ofrece corregir — corregir una
 * versión ya corregida partiría la cadena en dos ramas.
 */
export function actaVigente(actas: readonly ActaEnPantalla[]): ActaEnPantalla | null {
  const candidatas = actas.filter((a) => !a.reemplazada);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((mejor, a) => (a.version > mejor.version ? a : mejor));
}

/** De la más reciente a la más antigua, que es como se quiere leer la lista. */
export function ordenarActas(actas: readonly ActaEnPantalla[]): ActaEnPantalla[] {
  return [...actas].sort((a, b) => b.version - a.version || b.folio.localeCompare(a.folio));
}
