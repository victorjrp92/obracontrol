// Sugerencias de tareas por fase y espacio
// Basadas en la sección 12 del plan: Plantillas y Sugerencias Inteligentes

export interface TaskTemplate {
  nombre: string;
  tiempo_acordado_dias: number;
  codigo_referencia?: string;
  marca_linea?: string;
  componentes?: string;
}

export const ESPACIOS_SUGERIDOS = [
  "Cocina",
  "Baño principal",
  "Baño social",
  "Habitación principal",
  "Habitación 2",
  "Habitación 3",
  "Sala-comedor",
  "Zona de labores",
  "Hall",
];

export const TASK_TEMPLATES: Record<string, Record<string, TaskTemplate[]>> = {
  "Obra Blanca": {
    Cocina: [
      { nombre: "Estuco paredes cocina", tiempo_acordado_dias: 2 },
      { nombre: "Estuco techo cocina", tiempo_acordado_dias: 1 },
      { nombre: "Sellador cocina", tiempo_acordado_dias: 1 },
      { nombre: "Pintura base cocina", tiempo_acordado_dias: 1 },
      { nombre: "Pintura final cocina", tiempo_acordado_dias: 1 },
    ],
    "Baño principal": [
      { nombre: "Estuco paredes baño principal", tiempo_acordado_dias: 1 },
      { nombre: "Estuco techo baño principal", tiempo_acordado_dias: 1 },
      { nombre: "Pintura baño principal", tiempo_acordado_dias: 1 },
    ],
    "Baño social": [
      { nombre: "Estuco paredes baño social", tiempo_acordado_dias: 1 },
      { nombre: "Estuco techo baño social", tiempo_acordado_dias: 1 },
      { nombre: "Pintura baño social", tiempo_acordado_dias: 1 },
    ],
    "Habitación principal": [
      { nombre: "Estuco paredes habitación principal", tiempo_acordado_dias: 2 },
      { nombre: "Estuco techo habitación principal", tiempo_acordado_dias: 1 },
      { nombre: "Sellador habitación principal", tiempo_acordado_dias: 1 },
      { nombre: "Pintura base habitación principal", tiempo_acordado_dias: 1 },
      { nombre: "Pintura final habitación principal", tiempo_acordado_dias: 1 },
    ],
    "Habitación 2": [
      { nombre: "Estuco paredes habitación 2", tiempo_acordado_dias: 2 },
      { nombre: "Estuco techo habitación 2", tiempo_acordado_dias: 1 },
      { nombre: "Pintura habitación 2", tiempo_acordado_dias: 2 },
    ],
    "Habitación 3": [
      { nombre: "Estuco paredes habitación 3", tiempo_acordado_dias: 2 },
      { nombre: "Pintura habitación 3", tiempo_acordado_dias: 2 },
    ],
    "Sala-comedor": [
      { nombre: "Estuco paredes sala-comedor", tiempo_acordado_dias: 2 },
      { nombre: "Estuco techo sala-comedor", tiempo_acordado_dias: 2 },
      { nombre: "Sellador sala-comedor", tiempo_acordado_dias: 1 },
      { nombre: "Pintura base sala-comedor", tiempo_acordado_dias: 1 },
      { nombre: "Pintura final sala-comedor", tiempo_acordado_dias: 1 },
    ],
    "Zona de labores": [
      { nombre: "Estuco zona de labores", tiempo_acordado_dias: 1 },
      { nombre: "Pintura zona de labores", tiempo_acordado_dias: 1 },
    ],
    Hall: [
      { nombre: "Estuco paredes hall", tiempo_acordado_dias: 1 },
      { nombre: "Pintura hall", tiempo_acordado_dias: 1 },
    ],
  },
  Madera: {
    Cocina: [
      {
        nombre: "Mueble bajo cocina",
        tiempo_acordado_dias: 3,
        codigo_referencia: "MBK01",
        marca_linea: "SAGANO",
        componentes: "estructura + naves",
      },
      {
        nombre: "Mueble alto cocina",
        tiempo_acordado_dias: 3,
        codigo_referencia: "MBC01",
        marca_linea: "SAGANO",
        componentes: "estructura + puertas",
      },
    ],
    "Baño principal": [
      {
        nombre: "Mueble flotante lavamanos",
        tiempo_acordado_dias: 2,
        codigo_referencia: "PUM01",
        marca_linea: "AUSTRAL",
        componentes: "estructura + puerta",
      },
      { nombre: "Gabinete espejo baño principal", tiempo_acordado_dias: 1 },
    ],
    "Baño social": [
      { nombre: "Mueble lavamanos baño social", tiempo_acordado_dias: 2 },
    ],
    "Habitación principal": [
      {
        nombre: "Closet habitación principal",
        tiempo_acordado_dias: 4,
        codigo_referencia: "CLP01",
        marca_linea: "GRAFFO",
        componentes: "estructura + correderas",
      },
      { nombre: "Vestier habitación principal", tiempo_acordado_dias: 3 },
    ],
    "Habitación 2": [
      {
        nombre: "Closet habitación 2",
        tiempo_acordado_dias: 3,
        codigo_referencia: "CLP02",
        marca_linea: "GRAFFO",
      },
    ],
    "Habitación 3": [
      { nombre: "Closet habitación 3", tiempo_acordado_dias: 3 },
    ],
    "Zona de labores": [
      { nombre: "Mueble zona de labores", tiempo_acordado_dias: 2 },
    ],
  },
};

export function getTareasSugeridas(fase: string, espacio: string): TaskTemplate[] {
  return TASK_TEMPLATES[fase]?.[espacio] ?? [];
}
