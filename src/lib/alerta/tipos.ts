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

/** Los valores de `CalidadFoto` que dicen que la foto NO sirve tal como salió (todo menos "ok"). */
export type ProblemaCalidadFoto = Exclude<CalidadFoto, "ok">;

/**
 * Qué falló y qué hacer, por cada problema de calidad de foto. Lo usa
 * `observar-grieta.ts` para armar el motivo `"foto_mala"` y el wizard para
 * ofrecerle a la persona repetir la foto en vez de seguir con una lectura
 * dudosa.
 *
 * Mismo criterio de lenguaje que `copys.ts`: describe la FOTO, nunca la
 * grieta. Ninguna de estas frases opina sobre riesgo ni adelanta un nivel.
 */
export const DIAGNOSTICO_FOTO: Record<ProblemaCalidadFoto, { queFallo: string; consejo: string }> = {
  oscura: {
    queFallo: "La foto salió muy oscura.",
    consejo: "Prende la luz del lugar o usa el flash del celular y vuelve a tomarla.",
  },
  movida: {
    queFallo: "La foto salió movida.",
    consejo: "Apoya el codo o el celular en algo firme, espera a que enfoque y vuelve a tomarla.",
  },
  muy_lejos: {
    queFallo: "La foto se tomó demasiado lejos.",
    consejo: "Acércate hasta que la grieta y la moneda ocupen buena parte de la pantalla.",
  },
  sin_referencia_escala: {
    queFallo: "No se distingue la moneda de $500 junto a la grieta.",
    consejo: "Pon la moneda pegada a la grieta, sobre la misma pared, y repite la foto de acercamiento.",
  },
};

export type Nivel = "rojo" | "amarillo" | "verde";

export interface Veredicto {
  nivel: Nivel;
  razon: string; // "grieta diagonal en columna con acero expuesto"
  que_hacer: string;
  que_no_hacer: string[];
}
