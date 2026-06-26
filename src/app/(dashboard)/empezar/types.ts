import type { TipoObra, TipoPropiedad } from "@/lib/plantillas-personal";

/**
 * Contrato entre el wizard de creación de obras personales (B2C) y la server
 * action `crearObraPersonal`. Soporta 3 modos de estructura:
 *
 *  - CASA / LOCAL      → `pisos` (N pisos, cada uno con sus espacios)
 *  - APARTAMENTO       → `pisos` con 1 solo piso
 *  - EDIFICIO          → `edificio` (N pisos × M aptos/piso, espacios y tareas
 *                        definidos POR TIPO de apartamento, no apto por apto)
 *
 * El usuario piensa en espacios y tareas; la estructura física
 * (edificio → piso → unidad → espacio) se materializa en la persistencia.
 */

/** Una tarea concreta dentro de un espacio. */
export interface TareaInput {
  nombre: string;
  /** Días acordados para la tarea (repartidos del plazo, editable). */
  tiempo_acordado_dias: number;
  /** Precio acordado en COP (opcional, alimenta el índice de precios). */
  precio?: number;
  /** Solo se persisten las tareas activas ("qué falta por hacer"). */
  activa: boolean;
}

/** Un espacio renombrable dentro de un piso/unidad/tipo de apto. */
export interface EspacioInput {
  /** Nombre editable por el usuario, ej. "Cuarto principal". */
  nombre: string;
  /** m² opcional del espacio. */
  metraje?: number;
  tareas: TareaInput[];
}

/** Un piso de una Casa/Local (Apartamento usa un único piso). */
export interface PisoInput {
  numero: number;
  espacios: EspacioInput[];
}

/** Un tipo de apartamento dentro de un Edificio. */
export interface TipoAptoInput {
  /** Nombre del tipo, ej. "Tipo A". */
  nombre: string;
  /** Cuántas unidades de este tipo hay por piso (opcional). */
  cantidadPorPiso?: number;
  espacios: EspacioInput[];
}

/** Estructura específica del modo EDIFICIO. */
export interface EdificioInput {
  numPisos: number;
  aptosPorPiso: number;
  /** Si se usa nomenclatura de dirección (izq/der) — opcional. */
  usaDireccion?: boolean;
  tipos: TipoAptoInput[];
}

export interface CrearObraInput {
  tipoObra: TipoObra;
  /** Punto de partida de la obra (paso 1). */
  puntoPartida?: "NUEVA" | "MEDIAS" | "AVANZADA";
  tipoPropiedad: TipoPropiedad; // CASA | APARTAMENTO | EDIFICIO | LOCAL
  nombreObra: string;
  /** Solo contratista B2C: nombre del cliente dueño de la obra. */
  clienteNombre?: string;

  // ── Estructura según modo ────────────────────────────────────────────────
  /** CASA, LOCAL (N pisos) y APARTAMENTO (un único piso). */
  pisos?: PisoInput[];
  /** Solo EDIFICIO. */
  edificio?: EdificioInput;

  // ── Contexto (paso 4 + telemetría) ─────────────────────────────────────────
  fechaInicio?: string;
  fechaFin?: string;
  ubicacionLat?: number | null;
  ubicacionLng?: number | null;
  ciudad?: string;
  presupuestoTotal?: number;
  /**
   * Modo de presupuesto elegido por el usuario:
   *  - "ninguno"  → sin presupuesto; la IA estima el costo total por tarea.
   *  - "general"  → un único total (presupuestoTotal) repartido por peso real.
   *  - "separado" → dos bolsas (presupuestoManoObra + presupuestoMateriales).
   */
  modoPresupuesto?: "ninguno" | "general" | "separado";
  /** Modo "separado": bolsa de mano de obra (COP). */
  presupuestoManoObra?: number;
  /** Modo "separado": bolsa de materiales (COP). */
  presupuestoMateriales?: number;
  /** m² de toda la obra (alternativa a metraje por espacio). */
  metrajeTotal?: number;
}

export type CrearObraResult =
  | { ok: true; proyectoId: string }
  | { ok: false; error: string; limiteAlcanzado?: boolean };
