import type { TipoObra, TipoPropiedad } from "@/lib/plantillas-personal";

export interface CrearObraInput {
  tipoObra: TipoObra;
  tipoPropiedad: TipoPropiedad;
  nombreObra: string;
  /** Solo arquitecto: nombre del cliente dueño de la obra. */
  clienteNombre?: string;
  espacios: string[];
  /** Tareas elegidas por espacio (label del espacio → tareas). */
  tareasPorEspacio: Record<string, { nombre: string; tiempo_acordado_dias: number }[]>;
}

export type CrearObraResult =
  | { ok: true; proyectoId: string }
  | { ok: false; error: string; limiteAlcanzado?: boolean };
