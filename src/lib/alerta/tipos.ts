/**
 * Contrato de observación de una grieta — lo que en Fase 2 llenará el modelo
 * de visión (ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, sección A.1).
 *
 * TypeScript puro, sin dependencias de UI ni de red. Fase 1 no llama a ningún
 * modelo: estos tipos solo describen el contrato que va a consumir
 * `evaluarGrieta` en `reglas.ts`, para que el motor de reglas ya quede listo.
 */

export type Elemento =
  | "columna"
  | "viga"
  | "nudo_viga_columna"
  | "muro_carga"
  | "muro_divisorio"
  | "losa_techo"
  | "piso"
  | "fachada"
  | "no_determinado";

export type Patron =
  | "diagonal"
  | "diagonal_x"
  | "vertical"
  | "horizontal"
  | "escalonada"
  | "craquelado"
  | "esquina_vano"
  | "junta_entre_elementos";

export interface Banderas {
  acero_expuesto: boolean;
  concreto_triturado: boolean;
  desplazamiento_caras: boolean;
  elemento_inclinado: boolean;
  separacion_muro_estructura: boolean;
}

export type CalidadFoto = "ok" | "oscura" | "movida" | "muy_lejos" | "sin_referencia_escala";

export interface ObservacionGrieta {
  elemento: Elemento;
  patron: Patron;
  ancho_mm: number | null;
  banderas: Banderas;
  confianza: { elemento: number; patron: number; ancho: number };
  calidad_foto: CalidadFoto;
  /**
   * R2 (refinamiento de confiabilidad, 2026-08-13) — rango de incertidumbre
   * de la estimación de ancho con la moneda de referencia. Campo OPCIONAL y
   * puramente informativo: `reglas.ts` NUNCA lo lee (su diff sigue vacío) y
   * `ancho_mm` sigue siendo el único número que alimenta la regla 4.
   * `ancho_mm` se calcula como el extremo conservador del rango (`max`).
   * Existe para que un informe pueda decir "entre 2 y 4 mm" en vez de
   * fingir un número exacto que el modelo no puede medir.
   * Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md.
   */
  ancho_rango?: { min: number | null; max: number | null };
}

export type Nivel = "rojo" | "amarillo" | "verde";

export interface Veredicto {
  nivel: Nivel;
  razon: string; // "grieta diagonal en columna con acero expuesto"
  que_hacer: string;
  que_no_hacer: string[];
}
