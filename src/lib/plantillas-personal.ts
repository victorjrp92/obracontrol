import { TASK_TEMPLATES } from "@/lib/task-templates";
import type { SubtipoProyecto } from "@/generated/prisma";

/**
 * Plantillas amigables para el módulo de intención (cuentas personales).
 *
 * Traduce el mundo simple del usuario (espacios + "qué quiero hacer") a tareas
 * concretas, reutilizando TASK_TEMPLATES por debajo. Nunca devuelve una lista
 * vacía: si un espacio no tiene plantilla, cae a tareas genéricas razonables.
 */

export type TipoObra = "REFORMA" | "MODIFICACION" | "OBRA_NUEVA";
export type TipoPropiedad = "CASA" | "APARTAMENTO" | "EDIFICIO" | "LOCAL";

export const TIPOS_OBRA: { key: TipoObra; emoji: string; titulo: string; desc: string }[] = [
  { key: "REFORMA", emoji: "🔨", titulo: "Reformar algo que ya existe", desc: "Renovar, cambiar acabados, modernizar un espacio." },
  { key: "MODIFICACION", emoji: "📐", titulo: "Modificar o ampliar", desc: "Tumbar un muro, ampliar, redistribuir espacios." },
  { key: "OBRA_NUEVA", emoji: "✨", titulo: "Hacer algo nuevo desde cero", desc: "Construir o montar algo que no existe todavía." },
];

// Orden: Casa · Apartamento · Edificio · Local. El campo `emoji` queda como
// placeholder; el agente de frontend reemplaza por íconos SVG propios.
export const TIPOS_PROPIEDAD: { key: TipoPropiedad; emoji: string; label: string }[] = [
  { key: "CASA", emoji: "🏠", label: "Casa" },
  { key: "APARTAMENTO", emoji: "🏢", label: "Apartamento" },
  { key: "EDIFICIO", emoji: "🏬", label: "Edificio" },
  { key: "LOCAL", emoji: "🏪", label: "Local" },
];

/** Espacios que entiende un usuario normal, con su emoji y a qué plantilla mapean. */
export const ESPACIOS_PERSONAL: { key: string; emoji: string; label: string; plantilla?: string }[] = [
  { key: "cocina", emoji: "🍳", label: "Cocina", plantilla: "Cocina" },
  { key: "bano", emoji: "🚿", label: "Baño", plantilla: "Baño principal" },
  { key: "sala", emoji: "🛋️", label: "Sala", plantilla: "Sala-comedor" },
  { key: "comedor", emoji: "🍽️", label: "Comedor", plantilla: "Sala-comedor" },
  { key: "habitacion", emoji: "🛏️", label: "Habitación", plantilla: "Habitación principal" },
  { key: "estudio", emoji: "📚", label: "Estudio", plantilla: "Habitación 2" },
  { key: "lavanderia", emoji: "🧺", label: "Lavandería", plantilla: "Zona de lavado" },
  { key: "balcon", emoji: "🪴", label: "Balcón / Terraza" },
  { key: "garaje", emoji: "🚗", label: "Garaje" },
  { key: "fachada", emoji: "🧱", label: "Fachada" },
  { key: "pasillo", emoji: "🚪", label: "Pasillo", plantilla: "Pasillo" },
  { key: "otro", emoji: "➕", label: "Otro espacio" },
];

export interface TareaSugerida {
  nombre: string;
  tiempo_acordado_dias: number;
}

/** Tareas genéricas por tipo de obra, para espacios sin plantilla específica. */
function tareasGenericas(tipoObra: TipoObra): TareaSugerida[] {
  const base: TareaSugerida[] = [
    { nombre: "Resane y estuco de paredes", tiempo_acordado_dias: 2 },
    { nombre: "Pintura", tiempo_acordado_dias: 2 },
    { nombre: "Acabado de piso", tiempo_acordado_dias: 2 },
    { nombre: "Detalles finales y limpieza", tiempo_acordado_dias: 1 },
  ];
  if (tipoObra === "OBRA_NUEVA") {
    return [{ nombre: "Obra gris / muros", tiempo_acordado_dias: 3 }, ...base];
  }
  return base;
}

/**
 * Sugiere tareas para un espacio según lo que se quiere hacer.
 * - Reutiliza TASK_TEMPLATES (Obra Blanca + Madera) cuando hay plantilla.
 * - En REFORMA/MODIFICACION antepone una tarea de retiro de lo existente.
 */
export function sugerirTareas(espacioLabel: string, tipoObra: TipoObra): TareaSugerida[] {
  const espacio = ESPACIOS_PERSONAL.find((e) => e.label === espacioLabel || e.key === espacioLabel);
  const plantillaKey = espacio?.plantilla;

  let tareas: TareaSugerida[] = [];
  if (plantillaKey) {
    for (const fase of Object.keys(TASK_TEMPLATES)) {
      const delEspacio = TASK_TEMPLATES[fase]?.[plantillaKey];
      if (delEspacio) {
        tareas.push(...delEspacio.map((t) => ({ nombre: t.nombre, tiempo_acordado_dias: t.tiempo_acordado_dias })));
      }
    }
  }
  if (tareas.length === 0) tareas = tareasGenericas(tipoObra);

  if (tipoObra === "REFORMA" || tipoObra === "MODIFICACION") {
    const retiro = tipoObra === "MODIFICACION" ? "Demolición y adecuación" : "Retiro de acabados existentes";
    tareas = [{ nombre: retiro, tiempo_acordado_dias: 2 }, ...tareas];
  }
  return tareas;
}

/** Mapea el tipo de propiedad al subtipo del proyecto en el modelo real. */
export function subtipoDesdePropiedad(tipo: TipoPropiedad): SubtipoProyecto {
  // EDIFICIO y APARTAMENTO → APARTAMENTOS; CASA y LOCAL → CASAS.
  if (tipo === "EDIFICIO" || tipo === "APARTAMENTO") return "APARTAMENTOS";
  return "CASAS";
}

/** Etiqueta de la fase única de una obra personal según lo que se hace. */
export function nombreFaseDesdeObra(tipoObra: TipoObra): string {
  if (tipoObra === "OBRA_NUEVA") return "Obra nueva";
  if (tipoObra === "MODIFICACION") return "Modificación";
  return "Reforma";
}
