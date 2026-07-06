// ─────────────────────────────────────────────────────────────────────────
// Plantilla Excel única (B2C): helpers PUROS compartidos entre la generación
// (POST /api/plantilla-obra) y la importación (POST /api/plantilla-obra/parse).
//
// La UBICACIÓN de una fila de la plantilla puede ser:
//  - "Toda la propiedad"            → global de la obra (espacio "General" del piso 1)
//  - "Piso N (todo el piso)"        → global del piso N (espacio "General" del piso N)
//  - "Piso N – <Espacio>"           → espacio concreto del piso N
//  - "<Espacio>"                    → propiedad de UN solo piso (APARTAMENTO, o
//                                     casa/local de un piso): sin prefijo de piso.
//
// EDIFICIO queda FUERA de alcance de la plantilla en esta ronda.
// ─────────────────────────────────────────────────────────────────────────

/** Tipos de propiedad soportados por la plantilla (EDIFICIO fuera de alcance). */
export const TIPOS_PROPIEDAD_PLANTILLA = ["CASA", "APARTAMENTO", "LOCAL"] as const;
export type TipoPropiedadPlantilla = (typeof TIPOS_PROPIEDAD_PLANTILLA)[number];

/** Estructura ACTUAL del wizard (no persistida) que alimenta la plantilla. */
export interface EstructuraPlantilla {
  tipoPropiedad: TipoPropiedadPlantilla;
  pisos: { numero: number; espacios: string[] }[];
}

/** Opción global de obra del dropdown de Ubicación. */
export const UBICACION_TODA_PROPIEDAD = "Toda la propiedad";

/** Separador visual del dropdown "Piso N – Espacio" (en dash con espacios). */
export const SEPARADOR_UBICACION = " – ";

/** Etiqueta "Piso N (todo el piso)". */
export function etiquetaPisoCompleto(numero: number): string {
  return `Piso ${numero} (todo el piso)`;
}

/** Etiqueta calificada "Piso N – Espacio". */
export function etiquetaEspacio(piso: number, espacio: string): string {
  return `Piso ${piso}${SEPARADOR_UBICACION}${espacio}`;
}

/** Normaliza texto para comparar ubicaciones/espacios (minúsculas, sin tildes). */
export function normalizarComparacion(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Opciones del dropdown bloqueado de Ubicación, en orden:
 *  1. "Toda la propiedad"
 *  2. Por piso: "Piso N (todo el piso)" + "Piso N – <Espacio>"…
 * Con UN solo piso (APARTAMENTO, o casa/local de una planta) los espacios van
 * SIN prefijo de piso y se omite "Piso 1 (todo el piso)" (equivale a "Toda la
 * propiedad").
 */
export function opcionesUbicacion(estructura: EstructuraPlantilla): string[] {
  const opciones: string[] = [UBICACION_TODA_PROPIEDAD];
  const multiPiso = estructura.pisos.length > 1;

  for (const piso of estructura.pisos) {
    if (multiPiso) opciones.push(etiquetaPisoCompleto(piso.numero));
    for (const espacio of piso.espacios) {
      const nombre = espacio.trim();
      if (!nombre) continue;
      opciones.push(multiPiso ? etiquetaEspacio(piso.numero, nombre) : nombre);
    }
  }
  return opciones;
}

/** Destino estructurado de una ubicación parseada. */
export type DestinoUbicacion =
  | { tipo: "propiedad" }
  | { tipo: "piso"; piso: number }
  | { tipo: "espacio"; piso: number; espacio: string };

export interface UbicacionParseada {
  destino: DestinoUbicacion | null;
  /** true si la ubicación existe en la estructura dada (o si no hay estructura y la sintaxis es válida). */
  valida: boolean;
  /** true cuando la sintaxis se reconoció pero el espacio/piso ya no existe (huérfana). */
  huerfana: boolean;
}

const RE_PISO_COMPLETO = /^piso\s+(\d{1,3})\s*\(todo el piso\)$/;
// Acepta en dash, guion común o doble guion como separador ("Piso 2 – Cocina").
const RE_PISO_ESPACIO = /^piso\s+(\d{1,3})\s*(?:–|—|-{1,2})\s*(.+)$/;

/**
 * Interpreta el texto de la columna Ubicación de una fila importada.
 * Tolerante a mayúsculas/tildes y a variantes de guion. Si se pasa la
 * `estructura` actual del wizard, verifica que el piso/espacio EXISTA
 * (detección de ubicaciones huérfanas: renombraron el espacio después de
 * descargar la plantilla).
 */
export function parseUbicacion(
  texto: string,
  estructura?: EstructuraPlantilla | null,
): UbicacionParseada {
  const t = normalizarComparacion(texto);
  if (!t) return { destino: null, valida: false, huerfana: false };

  if (t === normalizarComparacion(UBICACION_TODA_PROPIEDAD)) {
    return { destino: { tipo: "propiedad" }, valida: true, huerfana: false };
  }

  const pisoDe = (n: number) => estructura?.pisos.find((p) => p.numero === n) ?? null;

  const mPiso = t.match(RE_PISO_COMPLETO);
  if (mPiso) {
    const piso = Number(mPiso[1]);
    const destino: DestinoUbicacion = { tipo: "piso", piso };
    if (!estructura) return { destino, valida: true, huerfana: false };
    const existe = pisoDe(piso) != null;
    return { destino, valida: existe, huerfana: !existe };
  }

  const mEspacio = t.match(RE_PISO_ESPACIO);
  if (mEspacio) {
    const piso = Number(mEspacio[1]);
    const espacioTxt = mEspacio[2].trim();
    // Para reportar la huérfana con el texto ORIGINAL (mayúsculas/tildes).
    const mOriginal = texto.trim().match(new RegExp(RE_PISO_ESPACIO.source, "i"));
    const espacioOriginal = mOriginal?.[2]?.trim() || espacioTxt;
    if (!estructura) {
      return { destino: { tipo: "espacio", piso, espacio: espacioOriginal }, valida: true, huerfana: false };
    }
    const p = pisoDe(piso);
    const espacioReal = p?.espacios.find(
      (e) => normalizarComparacion(e) === espacioTxt,
    );
    if (espacioReal) {
      return { destino: { tipo: "espacio", piso, espacio: espacioReal }, valida: true, huerfana: false };
    }
    return { destino: { tipo: "espacio", piso, espacio: espacioOriginal }, valida: false, huerfana: true };
  }

  // Sin prefijo de piso: propiedad de un solo piso ("Cocina").
  if (!estructura) {
    return { destino: { tipo: "espacio", piso: 1, espacio: texto.trim() }, valida: true, huerfana: false };
  }
  for (const p of estructura.pisos) {
    const espacioReal = p.espacios.find((e) => normalizarComparacion(e) === t);
    if (espacioReal) {
      return { destino: { tipo: "espacio", piso: p.numero, espacio: espacioReal }, valida: true, huerfana: false };
    }
  }
  return { destino: { tipo: "espacio", piso: 1, espacio: texto.trim() }, valida: false, huerfana: true };
}

/**
 * Valida y sanea la estructura recibida por las APIs de plantilla.
 * Devuelve `null` si el payload no tiene la forma esperada o el tipo de
 * propiedad está fuera de alcance (EDIFICIO). Aplica topes defensivos.
 */
export function estructuraValida(raw: unknown): EstructuraPlantilla | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tipo = o.tipoPropiedad;
  if (
    typeof tipo !== "string" ||
    !(TIPOS_PROPIEDAD_PLANTILLA as readonly string[]).includes(tipo)
  ) {
    return null;
  }
  if (!Array.isArray(o.pisos) || o.pisos.length === 0) return null;

  const MAX_PISOS = 30;
  const MAX_ESPACIOS = 40;
  const MAX_NOMBRE = 100;

  const pisos: EstructuraPlantilla["pisos"] = [];
  for (const p of (o.pisos as unknown[]).slice(0, MAX_PISOS)) {
    if (!p || typeof p !== "object") continue;
    const po = p as Record<string, unknown>;
    const numero = Math.round(Number(po.numero));
    if (!Number.isFinite(numero) || numero < 1 || numero > 999) continue;
    const espacios = Array.isArray(po.espacios)
      ? (po.espacios as unknown[])
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
          .map((e) => e.trim().slice(0, MAX_NOMBRE))
          .slice(0, MAX_ESPACIOS)
      : [];
    pisos.push({ numero, espacios });
  }
  if (pisos.length === 0) return null;

  // APARTAMENTO es de un solo piso por contrato del wizard.
  if (tipo === "APARTAMENTO" && pisos.length > 1) {
    return { tipoPropiedad: tipo, pisos: [pisos[0]] };
  }
  return { tipoPropiedad: tipo as TipoPropiedadPlantilla, pisos };
}
