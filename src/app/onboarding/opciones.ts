import type { Opcion } from "./PasoOpciones";

/**
 * Catálogo de opciones del cuestionario de onboarding (Fase 2).
 *
 * Los `value` son los enum-string EXACTOS que espera `POST /api/onboarding`.
 * Cualquier cambio aquí debe espejarse en los sets del backend
 * (`src/app/api/onboarding/route.ts`) y en el spec.
 */

// ── Contratista B2C ──────────────────────────────────────────────────────────

export const OPCIONES_OFICIO: Opcion[] = [
  { value: "ARQUITECTO", label: "Arquitecto" },
  { value: "MAESTRO_DE_OBRA", label: "Maestro de obra" },
  { value: "PINTOR", label: "Pintor" },
  { value: "CARPINTERO_EBANISTA", label: "Carpintero / Ebanista" },
  { value: "ELECTRICISTA", label: "Electricista" },
  { value: "PLOMERO_HIDROSANITARIO", label: "Plomero / Hidrosanitario" },
  { value: "ENCHAPADOR_ACABADOS", label: "Enchapador / Acabados" },
  { value: "INSTALADOR_COCINAS_CLOSETS", label: "Instalador de cocinas y closets" },
  { value: "ESTUCO_DRYWALL", label: "Estuco y drywall" },
  { value: "OBRA_GRIS_MAMPOSTERIA", label: "Obra gris / Mampostería" },
  { value: "CERRAJERIA_ESTRUCTURAS", label: "Cerrajería / Estructuras" },
  { value: "OTRO", label: "Otro" },
];

export const OPCIONES_TAMANO_EQUIPO: Opcion[] = [
  { value: "SOLO_YO", label: "Solo yo" },
  { value: "DE_2_A_5", label: "De 2 a 5 personas" },
  { value: "DE_6_A_10", label: "De 6 a 10 personas" },
  { value: "DE_11_A_20", label: "De 11 a 20 personas" },
  { value: "MAS_DE_20", label: "Más de 20 personas" },
];

// ── Común: ¿cómo controla hoy el trabajo? ────────────────────────────────────
// Selección MÚLTIPLE (checkboxes). Mismo set para Contratista, Propietario y
// Empresa. `SIN_CONTROL` es EXCLUSIVO (desmarca las demás y viceversa) y
// `OTRA_APP` abre un campo de texto "¿Cuál?" opcional (→ `control_otra`).

export const OPCIONES_CONTROL_ACTUAL: Opcion[] = [
  { value: "WHATSAPP_FOTOS", label: "WhatsApp y fotos" },
  { value: "EXCEL", label: "Excel" },
  { value: "CUADERNO", label: "Bloc de notas o cuaderno" },
  { value: "OTRA_APP", label: "Otra aplicación" },
  { value: "SIN_CONTROL", label: "No llevo control" },
];

// Variante de etiquetas para la Empresa (mismo conjunto de valores).
export const OPCIONES_CONTROL_EMPRESA: Opcion[] = [
  { value: "WHATSAPP_FOTOS", label: "WhatsApp y fotos" },
  { value: "EXCEL", label: "Excel" },
  { value: "CUADERNO", label: "Bloc de notas o cuaderno" },
  { value: "OTRA_APP", label: "Otra aplicación" },
  { value: "SIN_CONTROL", label: "No llevo control" },
];

/** Valor exclusivo del multi-select de control: al marcarlo se desmarcan las
 *  demás opciones (y al marcar cualquier otra, se desmarca este). */
export const CONTROL_EXCLUSIVO = "SIN_CONTROL";
/** Valor que abre el campo de texto "¿Cuál?" (→ `control_otra`). */
export const CONTROL_OTRA_APP = "OTRA_APP";

// ── Propietario ──────────────────────────────────────────────────────────────
// `primera_obra` es boolean en el backend: usamos strings "SI"/"NO" en la UI y
// convertimos al enviar.

export const OPCIONES_PRIMERA_OBRA: Opcion[] = [
  { value: "SI", label: "Es mi primera obra" },
  { value: "NO", label: "Ya he hecho otras" },
];

export const OPCIONES_TIENE_CONTRATISTA: Opcion[] = [
  { value: "YA_TENGO", label: "Ya tengo maestro o contratista" },
  { value: "LO_ESTOY_BUSCANDO", label: "Lo estoy buscando" },
];

// ── Empresa (constructora) ───────────────────────────────────────────────────

export const OPCIONES_OBRAS_ACTIVAS: Opcion[] = [
  { value: "UNA", label: "1 obra" },
  { value: "DE_2_A_5", label: "De 2 a 5 obras" },
  { value: "DE_6_A_15", label: "De 6 a 15 obras" },
  { value: "MAS_DE_15", label: "Más de 15 obras" },
];

export const OPCIONES_TIPO_OBRA: Opcion[] = [
  { value: "VIS_VIP", label: "VIS / VIP" },
  { value: "ESTRATO_MEDIO_ALTO", label: "Estrato medio-alto" },
  { value: "COMERCIAL", label: "Comercial" },
  { value: "REMODELACION", label: "Remodelación" },
  { value: "INFRAESTRUCTURA", label: "Infraestructura" },
];

export const OPCIONES_NUM_CONTRATISTAS: Opcion[] = [
  { value: "DE_1_A_5", label: "De 1 a 5 contratistas" },
  { value: "DE_6_A_15", label: "De 6 a 15 contratistas" },
  { value: "DE_16_A_30", label: "De 16 a 30 contratistas" },
  { value: "MAS_DE_30", label: "Más de 30 contratistas" },
];
