// ─────────────────────────────────────────────────────────────────────────
// Tipos COMPARTIDOS del import del Excel único (lado cliente). Reflejan el
// contrato del endpoint `POST /api/plantilla-obra/parse` (ver la ruta) y el
// "resuelto" que el paso de revisión entrega al wizard para crear las tareas.
//
// Se declaran aquí (no en la ruta) para reusarlos entre el panel de import, el
// modal de revisión y el wizard sin acoplar el frontend al archivo del backend.
// ─────────────────────────────────────────────────────────────────────────

import type { DestinoUbicacion } from "@/lib/plantilla-obra";
import type { FaseObra } from "@/lib/fases-obra";

/** Una fila del preview devuelto por el parser (mismo shape del backend). */
export interface FilaPreview {
  fila: number;
  fase: string;
  faseReconocida: boolean;
  faseNormalizada?: FaseObra;
  tarea: string;
  ubicacion: string;
  ubicacionValida: boolean;
  destino?: DestinoUbicacion;
  manoObra?: number;
  materiales?: number;
  total?: number;
  flags: string[];
}

/** Resumen agregado del preview (mismo shape del backend). */
export interface ResumenPreview {
  totalFilas: number;
  validas: number;
  conPresupuesto: number;
  soloTotal: number;
  sinPresupuesto: number;
  fasesNoReconocidas: string[];
  ubicacionesInvalidas: number;
  duplicadas: number;
  conFlags: number;
  omitidas: number;
}

/** Respuesta 200 completa del parser. */
export interface PreviewImport {
  ok: true;
  filas: FilaPreview[];
  resumen: ResumenPreview;
}

/**
 * Tarea ya RESUELTA por el usuario en el paso de revisión, lista para volcar
 * al estado del wizard. El `destino` ya quedó reasignado (o descartado, en
 * cuyo caso la fila no llega hasta aquí). `precio` es el total; el desglose es
 * opcional (viene del archivo o de la estimación de división M.O./materiales).
 */
export interface TareaImportadaResuelta {
  nombre: string;
  destino: DestinoUbicacion;
  fase?: FaseObra;
  precio?: number;
  presupuestoManoObra?: number;
  presupuestoMateriales?: number;
}
