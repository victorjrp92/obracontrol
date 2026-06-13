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
  lustro_dias?: number;        // independent days for "Detallado y lustro"
  lustro_precio?: number;      // independent price for "Detallado y lustro"
  lustro_excluido?: boolean;   // true if this task should NOT generate a lustro record
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
  contratistaDefaultId?: string;
  clienteId?: string;
  subtipo: "APARTAMENTOS" | "CASAS" | "ZONAS_COMUNES";
  diasHabiles: number;
  fechaInicio: string;
  fechaFin: string;
  tiposUnidad: TipoUnidadInput[];
  edificios: EdificioInput[];
  fasesSeleccionadas: string[];
  faseDias: Record<string, number | undefined>;
  tareas: TareaInput[];
  ubicacion?: UbicacionInput | null;
  tieneZonasComunes: boolean;
  zonasSeleccionadas: string[];
  metrosEnabled: boolean;
  metrosZonas: Record<string, number>;
  dbIdMap: {
    fases: Record<string, string>;      // fase nombre -> db ID
    tiposUnidad: Record<string, string>; // local tipo id -> db ID
  };
  // Asignaciones existentes derivadas del estado real de la BD (tareas con
  // asignado_a no nulo), agrupadas en el scope más amplio donde son
  // consistentes (global > por torre > por torre+unidad).
  asignaciones?: AsignacionOverride[];
}

export interface UbicacionInput {
  lat: number;
  lng: number;
  direccion?: string;
}

export interface AsignacionOverride {
  fase: string;
  subfase?: string | null;
  torre?: string | null;
  unidad_nombre?: string | null;
  espacio?: string | null;
  tarea_nombre?: string | null;
  contratista_id: string;
}

export function generateUnitNamesForTorre(
  edificio: EdificioInput,
  tiposUnidad: TipoUnidadInput[],
): { piso: number; nombre: string; tipo_unidad_id: string; sentido: string }[] {
  if (edificio.unidades_detalle) {
    const result: { piso: number; nombre: string; tipo_unidad_id: string; sentido: string }[] = [];
    for (const [pisoStr, units] of Object.entries(edificio.unidades_detalle)) {
      for (const u of units) {
        result.push({ piso: Number(pisoStr), nombre: u.nombre, tipo_unidad_id: u.tipo_unidad_id, sentido: u.sentido });
      }
    }
    return result;
  }
  const units: { piso: number; nombre: string; tipo_unidad_id: string; sentido: string }[] = [];
  const flatList: { tipo_unidad_id: string; sentido: string }[] = [];
  for (const tipo of tiposUnidad) {
    const dist = edificio.distribucion[tipo.id];
    if (!dist) continue;
    for (let i = 0; i < (dist.derecha ?? 0); i++) flatList.push({ tipo_unidad_id: tipo.id, sentido: "derecha" });
    for (let i = 0; i < (dist.izquierda ?? 0); i++) flatList.push({ tipo_unidad_id: tipo.id, sentido: "izquierda" });
  }
  const udsPerFloor = edificio.unidades_por_piso ?? 0;
  if (udsPerFloor <= 0) return [];
  for (let p = 1; p <= edificio.pisos; p++) {
    const start = (p - 1) * udsPerFloor;
    for (let slot = 0; slot < udsPerFloor; slot++) {
      const idx = start + slot;
      const entry = flatList[idx] ?? flatList[flatList.length - 1];
      if (!entry) continue;
      units.push({ piso: p, nombre: `${p}0${slot + 1}`, tipo_unidad_id: entry.tipo_unidad_id, sentido: entry.sentido });
    }
  }
  return units;
}

export const SUBFASES_MADERA = ["Instalación", "Detallado y lustro"] as const;

export const FASES_DISPONIBLES = ["Madera", "Obra Blanca"];
