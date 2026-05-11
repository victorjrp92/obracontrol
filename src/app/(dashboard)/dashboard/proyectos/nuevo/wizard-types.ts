export interface Contratista {
  id: string;
  nombre: string;
  rol_ref: { nombre: string };
}

export interface TipoUnidadInput {
  id: string;
  nombre: string;
  espacios: string[];
  metraje_total?: number;              // m² total of the unit
  metrajes_espacios?: Record<string, number>;  // space_name -> m²
}

export interface FaseInput {
  nombre: string;
  tiempo_estimado_dias?: number;
}

export interface UnidadDetailInput {
  nombre: string;           // e.g. "301"
  tipo_unidad_id: string;   // local tipo id
  sentido: "derecha" | "izquierda";
  nombre_personalizado?: string;
}

export interface DistribucionSentido {
  derecha: number;
  izquierda: number;
}

export interface EdificioInput {
  nombre: string;
  pisos: number;
  unidades_por_piso?: number; // user-defined, independent from distribucion sum
  distribucion: Record<string, DistribucionSentido>; // tipo.id -> { derecha, izquierda } per floor
  unidades_detalle?: Record<number, UnidadDetailInput[]>; // keyed by floor number
}

export interface TareaInput {
  id: string; // local id
  fase: string;
  subfase?: string;
  espacio: string;
  nombre: string;
  tiempo_acordado_dias: number;
  precio?: number;
  codigo_referencia?: string;
  marca_linea?: string;
  componentes?: string;
  asignado_a?: string;
  tipo_unidad_id?: string;     // which tipo this task applies to (Madera per-tipo)
  tiene_estructura?: boolean;
  tiene_nave?: boolean;
  tiene_chapa?: boolean;
  tiene_cartera?: boolean;
}

export interface TorreAssignment {
  contratista_global: string | null;
  desglosado: boolean;
  por_actividad: Record<string, string | null>; // espacio -> contratista ID
  por_subfase?: Record<string, string | null>; // subfase name -> contratista ID (Madera)
}

export interface FaseAssignment {
  fase: string;
  contratistas: string[]; // IDs of contratistas assigned to this phase
  distribucion: Record<string, TorreAssignment>; // edificio nombre -> assignment
}

export interface PersonaProyectoInput {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
}

export interface EditModeData {
  projectId: string;
  nombre: string;
  numeroRegistro?: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  diasHabiles: number;
  fechaInicio: string;
  fechaFin: string;
  tiposUnidad: TipoUnidadInput[];
  edificios: EdificioInput[];
  fasesSeleccionadas: string[];
  faseDias: Record<string, number | undefined>;
  tareas: TareaInput[];
  tieneZonasComunes: boolean;
  zonasSeleccionadas: string[];
  metrosEnabled: boolean;
  metrosZonas: Record<string, number>;
  dbIdMap: {
    fases: Record<string, string>;      // fase nombre -> db ID
    tiposUnidad: Record<string, string>; // local tipo id -> db ID
  };
}

export const SUBFASES_MADERA = ["Instalación", "Detallado y lustro"] as const;

export const FASES_DISPONIBLES = ["Madera", "Obra Blanca"];
