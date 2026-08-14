/**
 * Filtro de seguridad del Paso 0 (spec A.5) — reglas AIS simplificadas,
 * independientes del motor de grietas de `reglas.ts`. Cuatro preguntas
 * sí/no que cortan el flujo ANTES de cualquier foto: cualquier "sí" es
 * señal de riesgo inmediato y no requiere (ni admite) más análisis.
 *
 * TypeScript puro, sin dependencias de UI ni de red.
 */

export interface FiltroSeguridadRespuestas {
  edificioInclinado: boolean;
  columnaReventadaOVarillaExpuesta: boolean;
  pisosDesnivelados: boolean;
  olorAGas: boolean;
}

/** true = "salí ahora", corta el flujo. Sin excepciones, sin IA de por medio. */
export function evaluarFiltroSeguridad(r: FiltroSeguridadRespuestas): boolean {
  return r.edificioInclinado || r.columnaReventadaOVarillaExpuesta || r.pisosDesnivelados || r.olorAGas;
}
