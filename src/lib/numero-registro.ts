/**
 * Utilidades para el sistema de números de registro de proyectos y tareas.
 *
 * Convención del negocio:
 *   - Proyecto: lo escribe el Admin General o el Admin Junior. Texto libre,
 *     único por constructora. Ej: "PR-2026-001", "CALI-OBRA-12".
 *   - Tarea: se autogenera con formato {proyecto.numero_registro}-T{seq:4}
 *     para mantener la trazabilidad sin errores tipográficos.
 */

const PROYECTO_PATTERN = /^[A-Z0-9][A-Z0-9\-_/]{1,39}$/;

export function normalizarNumeroProyecto(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

export interface NumeroValidationResult {
  ok: boolean;
  normalizado?: string;
  error?: string;
}

export function validarNumeroProyecto(input: string | undefined | null): NumeroValidationResult {
  if (!input || !input.trim()) {
    return { ok: false, error: "El número de registro del proyecto es obligatorio" };
  }
  const normalizado = normalizarNumeroProyecto(input);
  if (!PROYECTO_PATTERN.test(normalizado)) {
    return {
      ok: false,
      error: "Solo letras, números y los símbolos - _ /. Mínimo 2 y máximo 40 caracteres.",
    };
  }
  return { ok: true, normalizado };
}

/**
 * Genera el número de registro de una tarea según el número del proyecto y un
 * contador secuencial (1-based).
 *   numeroTarea("PR-2026-001", 7)  →  "PR-2026-001-T0007"
 */
export function generarNumeroTarea(numeroProyecto: string, secuencia: number): string {
  return `${numeroProyecto}-T${String(secuencia).padStart(4, "0")}`;
}
