import { EspecialidadObrero } from "@/generated/prisma";

export const ESPECIALIDADES: EspecialidadObrero[] = [
  "ALBANIL",
  "INSTALADOR",
  "ELECTRICISTA",
  "PLOMERO",
  "PINTOR",
  "CARPINTERO",
  "ENCHAPADOR",
  "ESTUCADOR",
  "AYUDANTE",
  "OTRO",
];

export const ESPECIALIDAD_LABEL: Record<EspecialidadObrero, string> = {
  ALBANIL: "Albañil",
  INSTALADOR: "Instalador",
  ELECTRICISTA: "Electricista",
  PLOMERO: "Plomero",
  PINTOR: "Pintor",
  CARPINTERO: "Carpintero",
  ENCHAPADOR: "Enchapador",
  ESTUCADOR: "Estucador",
  AYUDANTE: "Ayudante general",
  OTRO: "Otro",
};

export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

export interface ObreroBasicoInput {
  cedula?: string;
  telefono?: string;
  especialidad?: string;
  eps?: string;
  arl?: string;
}

export interface ObreroValidationError {
  field: keyof ObreroBasicoInput;
  message: string;
}

/**
 * Valida los campos obligatorios para crear un obrero según las reglas del negocio.
 * Devuelve un array vacío si todo está OK.
 */
export function validateObreroBasico(input: ObreroBasicoInput): ObreroValidationError[] {
  const errors: ObreroValidationError[] = [];

  if (!input.cedula || input.cedula.trim().length < 5) {
    errors.push({ field: "cedula", message: "La cédula es obligatoria (mínimo 5 dígitos)" });
  } else if (!/^[0-9]+$/.test(input.cedula.trim())) {
    errors.push({ field: "cedula", message: "La cédula solo debe contener números" });
  }

  if (!input.telefono || input.telefono.trim().length < 7) {
    errors.push({ field: "telefono", message: "El teléfono es obligatorio (mínimo 7 dígitos)" });
  }

  if (!input.especialidad || !ESPECIALIDADES.includes(input.especialidad as EspecialidadObrero)) {
    errors.push({ field: "especialidad", message: "Selecciona una especialidad válida" });
  }

  // EPS y ARL son OPCIONALES por ahora — no se validan como obligatorias.

  return errors;
}

/**
 * Recalcula los scores del obrero según sus evidencias y tareas.
 * - score_calidad: % evidencias aprobadas / (aprobadas + rechazadas)
 * - score_velocidad: aprox basado en velocidad de re-reporte (placeholder)
 * - score_cumplimiento: % tareas completadas / esperadas (placeholder)
 * - score_total: promedio ponderado
 *
 * Esta función es liviana y se puede llamar después de cada aprobación/rechazo.
 */
export interface ScoringInput {
  evidencias_aprobadas: number;
  evidencias_rechazadas: number;
  tareas_completadas: number;
  // Datos opcionales para velocidad / cumplimiento
  tareas_a_tiempo?: number;
  tareas_totales?: number;
}

export interface ScoringResult {
  score_total: number;
  score_calidad: number;
  score_velocidad: number;
  score_cumplimiento: number;
}

export function calcularScoringObrero(input: ScoringInput): ScoringResult {
  const totalEvidencias = input.evidencias_aprobadas + input.evidencias_rechazadas;
  const score_calidad = totalEvidencias > 0
    ? Math.round((input.evidencias_aprobadas / totalEvidencias) * 100)
    : 0;

  const score_cumplimiento = input.tareas_totales && input.tareas_totales > 0
    ? Math.round(((input.tareas_a_tiempo ?? input.tareas_completadas) / input.tareas_totales) * 100)
    : input.tareas_completadas > 0
    ? 80
    : 0;

  // Velocidad: placeholder — se puede afinar luego con tiempos reales
  const score_velocidad = totalEvidencias > 0
    ? Math.max(0, Math.min(100, 100 - input.evidencias_rechazadas * 10))
    : 0;

  // Promedio ponderado: 50% calidad, 30% cumplimiento, 20% velocidad
  const score_total = Math.round(
    score_calidad * 0.5 + score_cumplimiento * 0.3 + score_velocidad * 0.2,
  );

  return { score_total, score_calidad, score_velocidad, score_cumplimiento };
}
