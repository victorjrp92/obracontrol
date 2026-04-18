export interface Contratista {
  id: string;
  nombre: string;
  rol_ref: { nombre: string };
}

export interface TipoUnidadInput {
  id: string;
  nombre: string;
  espacios: string[];
}

export interface EdificioInput {
  nombre: string;
  pisos: number;
  distribucion: Record<string, number>; // tipo.id -> count per floor
}

export interface TareaInput {
  id: string; // local id
  fase: string;
  espacio: string;
  nombre: string;
  tiempo_acordado_dias: number;
  codigo_referencia?: string;
  marca_linea?: string;
  componentes?: string;
  asignado_a?: string;
}

export interface TorreAssignment {
  contratista_global: string | null;
  desglosado: boolean;
  por_actividad: Record<string, string | null>; // espacio -> contratista ID
}

export interface FaseAssignment {
  fase: string;
  contratistas: string[]; // IDs of contratistas assigned to this phase
  distribucion: Record<string, TorreAssignment>; // edificio nombre -> assignment
}

export const FASES_DISPONIBLES = ["Madera", "Obra Blanca"];
