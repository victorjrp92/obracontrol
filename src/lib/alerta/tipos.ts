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
}

export type Nivel = "rojo" | "amarillo" | "verde";

export interface Veredicto {
  nivel: Nivel;
  razon: string; // "grieta diagonal en columna con acero expuesto"
  que_hacer: string;
  que_no_hacer: string[];
}
