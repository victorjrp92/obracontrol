import type { Hallazgo, ResultadoVerificacion } from "./tipos";

/**
 * Reglas puras de la verificación: cómo se coteja una huella y qué se responde
 * a partir de lo que devolvieron las fuentes. Sin base de datos a propósito —
 * así se pueden verificar con casos fijos.
 */

/**
 * Mínimo de hex que hay que aportar para que cotejar signifique algo. Por
 * debajo, un prefijo corto coincidiría con demasiados documentos y la respuesta
 * «el contenido coincide» no valdría nada.
 */
export const LARGO_MINIMO_HUELLA = 8;

/**
 * ¿La huella que trae quien consulta corresponde al documento guardado?
 *
 * Se acepta tanto la corta impresa en el pie como el SHA-256 completo, de ahí
 * el `startsWith`. `null` significa «no mandó huella», que no es lo mismo que
 * «no coincide».
 */
export function cotejarHuella(hashGuardado: string, huella?: string | null): boolean | null {
  if (!huella) return null;
  const limpia = huella.trim().toLowerCase();
  return hashGuardado.toLowerCase().startsWith(limpia) && limpia.length >= LARGO_MINIMO_HUELLA;
}

/** Fecha de emisión como la ve quien consulta: `AAAA-MM-DD`. */
export function fechaEmision(emitido: Date): string {
  return emitido.toISOString().slice(0, 10);
}

/**
 * Traduce lo que dijeron las fuentes en la respuesta al público.
 *
 * El orden de las tres decisiones no es casual:
 *  1. Si alguna fuente lo encontró, existe — aunque otra no haya respondido.
 *  2. Si ninguna lo encontró pero alguna no pudo responder, NO se dice «no
 *     existe»: el documento podría estar justo en la tabla que falló.
 *  3. Solo cuando todas respondieron y ninguna lo tiene, no existe.
 */
export function resolverVerificacion(
  hallazgos: readonly Hallazgo[],
  huella?: string | null
): ResultadoVerificacion {
  const hallado = hallazgos.find(
    (h): h is Extract<Hallazgo, { estado: "encontrado" }> => h.estado === "encontrado"
  );

  if (hallado) {
    const doc = hallado.documento;
    // Las dos claves nuevas se AÑADEN solo cuando la fuente las trae. Un
    // documento sin firmas responde exactamente lo mismo que respondía antes de
    // que existieran las firmas — byte por byte, incluidas las claves y su
    // orden. No es una cortesía: `scripts/verificar-documentos.ts` congela esa
    // forma porque hay documentos ya emitidos que se verifican contra ella.
    return {
      existe: true,
      tipo: doc.tipo,
      emitido: fechaEmision(doc.emitido),
      huellaCoincide: cotejarHuella(doc.hash, huella),
      ...(doc.firmas ? { firmas: doc.firmas } : {}),
      ...(doc.vigencia ? { vigencia: doc.vigencia } : {}),
    };
  }

  if (hallazgos.some((h) => h.estado === "indisponible")) return { indisponible: true };

  return { existe: false };
}
