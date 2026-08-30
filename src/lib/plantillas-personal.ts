import { TASK_TEMPLATES } from "@/lib/task-templates";
import type { SubtipoProyecto } from "@/generated/prisma";

/**
 * Plantillas amigables para el módulo de intención (cuentas personales).
 *
 * Traduce el mundo simple del usuario (espacios + "qué quiero hacer") a tareas
 * concretas, reutilizando TASK_TEMPLATES por debajo. Nunca devuelve una lista
 * vacía: si un espacio no tiene plantilla, cae a tareas genéricas razonables.
 */

export type TipoObra = "REFORMA" | "OBRA_NUEVA";
export type TipoPropiedad = "CASA" | "APARTAMENTO" | "EDIFICIO" | "LOCAL";

/**
 * `TIPOS_OBRA` fusiona lo que eran DOS intenciones — "Reformar algo que ya
 * existe" y "Modificar o ampliar" — en una sola: para el usuario, cambiar
 * acabados y tumbar un muro son la misma primera decisión ("ya tengo algo y
 * quiero trabajar sobre eso"), frente a "voy a construir algo que no existe".
 *
 * La clave que sobrevive es "REFORMA", no "MODIFICACION": en el vocabulario
 * de construcción en Colombia "reforma" ya funciona como término paraguas
 * (cubre desde renovar acabados hasta redistribuir espacios), mientras que
 * "modificación" suena a trámite puntual (permiso, plano) y encajaba peor
 * como categoría amplia para el catálogo. Los proyectos ya creados con
 * `tipo_obra = "MODIFICACION"` en la base siguen abriendo sin error: usa
 * `resolverTipoObra` para traducir ese valor histórico a "REFORMA" al leer
 * desde la base.
 */
export const TIPOS_OBRA: { key: TipoObra; emoji: string; titulo: string; desc: string }[] = [
  {
    key: "REFORMA",
    emoji: "🔨",
    titulo: "Trabajar sobre algo que ya existe",
    desc: "Renovar acabados, tumbar un muro, ampliar o redistribuir un espacio.",
  },
  {
    key: "OBRA_NUEVA",
    emoji: "✨",
    titulo: "Hacer algo nuevo desde cero",
    desc: "Construir o montar algo que no existe todavía.",
  },
];

/**
 * Resuelve el string crudo de `Proyecto.tipo_obra` (columna `String?`, sin
 * enum a nivel de base — ver prisma/schema.prisma) a una de las dos claves
 * vigentes en `TIPOS_OBRA`. Existe por compatibilidad: hay obras creadas
 * antes de la fusión con `tipo_obra = "MODIFICACION"` guardado en la base, y
 * esa clave ya no está en el catálogo. Sin este mapeo, cualquier lectura que
 * busque la etiqueta/ícono de "MODIFICACION" en `TIPOS_OBRA` no encontraría
 * nada y la obra dejaría de abrir bien. Cualquier valor nulo o desconocido
 * también cae a "REFORMA" (mismo default que tenía el código antes de la
 * fusión).
 */
export function resolverTipoObra(valor: string | null | undefined): TipoObra {
  if (valor === "OBRA_NUEVA") return "OBRA_NUEVA";
  // "REFORMA" | "MODIFICACION" (legado, fusionado aquí) | null | otro valor.
  return "REFORMA";
}

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

/**
 * Catálogo de espacios para `LOCAL` (comercio): NO es la lista de una vivienda
 * con la palabra cambiada — un local no tiene "Habitaciones". Cada entrada se
 * eligió porque `sugerirTareas()` le resuelve tareas reales, no al revés:
 *
 *  - `cocina_local` reutiliza la plantilla "Cocina" (mismo TASK_TEMPLATES que
 *    una cocina residencial): un área de preparación hace el mismo acabado
 *    (estuco/sellador/pintura) y los mismos muebles bajos/altos.
 *  - `bano_clientes` reutiliza "Baño social": en el vocabulario colombiano de
 *    vivienda "social" ya significa "baño de visitas" (frente a "principal" =
 *    privado), que es exactamente lo que es un baño de clientes.
 *  - `bano_personal`, `zona_atencion`, `bodega`, `vitrina`, `oficina`, `caja`
 *    NO tienen plantilla propia (no existe una plantilla de comercio en
 *    TASK_TEMPLATES) y caen a `tareasGenericas()`: resanar/pintura/acabado de
 *    piso/detalles y limpieza (+ demolición o levantar muros según la obra).
 *    Esas cuatro tareas genéricas SIEMPRE resuelven rendimiento y fase (se
 *    verifica en scripts/verificar-espacios.ts) — es la ruta segura para un
 *    espacio de comercio sin plantilla dedicada, en vez de inventar una tarea
 *    que el motor no sepa estimar.
 *
 * "Bodega/depósito" y "vitrina/fachada comercial" van como una sola entrada
 * cada una (son el mismo concepto en el uso cotidiano de un local colombiano)
 * en vez de duplicar espacios casi idénticos sin una tarea distinta entre sí.
 */
export const ESPACIOS_LOCAL: { key: string; emoji: string; label: string; plantilla?: string }[] = [
  { key: "zona_atencion", emoji: "🛍️", label: "Zona de atención al público" },
  { key: "bodega", emoji: "📦", label: "Bodega / depósito" },
  { key: "bano_clientes", emoji: "🚻", label: "Baño de clientes", plantilla: "Baño social" },
  { key: "bano_personal", emoji: "🧻", label: "Baño de personal" },
  { key: "cocina_local", emoji: "🍳", label: "Cocina / zona de preparación", plantilla: "Cocina" },
  { key: "vitrina", emoji: "🪟", label: "Vitrina / fachada comercial" },
  { key: "oficina", emoji: "🗄️", label: "Oficina" },
  { key: "caja", emoji: "💳", label: "Zona de caja" },
  { key: "otro", emoji: "➕", label: "Otro espacio" },
];

/**
 * Catálogo de espacios a mostrar según el tipo de propiedad. Solo `LOCAL`
 * tiene catálogo propio (comercio); `CASA`/`APARTAMENTO`/`EDIFICIO` usan el
 * catálogo residencial de siempre, sin cambios.
 */
export function espaciosParaTipo(tipo: TipoPropiedad | null): typeof ESPACIOS_PERSONAL {
  return tipo === "LOCAL" ? ESPACIOS_LOCAL : ESPACIOS_PERSONAL;
}

export interface TareaSugerida {
  nombre: string;
  tiempo_acordado_dias: number;
}

/** Tareas genéricas por tipo de obra, para espacios sin plantilla específica. */
function tareasGenericas(tipoObra: TipoObra): TareaSugerida[] {
  const base: TareaSugerida[] = [
    { nombre: "Resanar y alisar paredes", tiempo_acordado_dias: 2 },
    { nombre: "Pintura", tiempo_acordado_dias: 2 },
    { nombre: "Acabado de piso", tiempo_acordado_dias: 2 },
    { nombre: "Detalles finales y limpieza", tiempo_acordado_dias: 1 },
  ];
  if (tipoObra === "OBRA_NUEVA") {
    return [{ nombre: "Levantar muros y obra gruesa", tiempo_acordado_dias: 3 }, ...base];
  }
  return base;
}

/**
 * Sugiere tareas para un espacio según lo que se quiere hacer.
 * - Reutiliza TASK_TEMPLATES (Obra Blanca + Madera) cuando hay plantilla.
 * - En REFORMA antepone una tarea de demolición/retiro de lo existente: cubre
 *   tanto "cambiar acabados" como "tumbar un muro", las dos intenciones que
 *   se fusionaron en esta clave (ver comentario de `TIPOS_OBRA`).
 */
export function sugerirTareas(espacioLabel: string, tipoObra: TipoObra): TareaSugerida[] {
  // Busca primero en el catálogo residencial y, si no aparece, en el de
  // comercio (LOCAL): las labels/keys de los dos catálogos no se pisan, así
  // que no hace falta que el llamador diga de qué tipo de propiedad viene.
  const espacio =
    ESPACIOS_PERSONAL.find((e) => e.label === espacioLabel || e.key === espacioLabel) ??
    ESPACIOS_LOCAL.find((e) => e.label === espacioLabel || e.key === espacioLabel);
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

  if (tipoObra === "REFORMA") {
    tareas = [{ nombre: "Demolición y retiro de acabados existentes", tiempo_acordado_dias: 2 }, ...tareas];
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
  return tipoObra === "OBRA_NUEVA" ? "Obra nueva" : "Reforma";
}

// ─── Modificaciones generales (sin espacio concreto) ──────────────────────────

export interface ModificacionGeneral {
  key: string;
  emoji: string;
  label: string;
  /** Tarea que se crea en cada espacio al aplicar esta modificación. */
  tarea: TareaSugerida;
}

/**
 * Modificaciones que NO se atan a un espacio concreto: techo, pisos, pintura
 * general. Regla de producto: si el usuario no declara un espacio para una de
 * estas, se asume que aplica a TODO el piso — `expandirModificacionesGenerales`
 * la convierte en una tarea por cada espacio real del piso al construir el
 * proyecto.
 *
 * No usan el espacio reservado `ESPACIO_GENERAL` ("General", ver
 * `empezar/types.ts`) que ya existe para el import de Excel: ese bucket es
 * para tareas LIBRES tipeadas por el usuario, y agruparlas ahí rompería el
 * seguimiento por espacio (evidencia/progreso cuelga de Espacio→Tarea, ver
 * AGENTS.md). Estas son tareas CURADAS que sí queremos ver reflejadas en el
 * progreso de cada espacio real, igual que cualquier otra tarea sugerida.
 */
export const MODIFICACIONES_GENERALES: ModificacionGeneral[] = [
  {
    key: "techo",
    emoji: "🏠",
    label: "Techo / cubierta",
    // Nombre elegido para que también resuelva rendimiento y fase en
    // rendimientos.ts/fases-obra.ts (clave `impermeabilizacion`, cubre
    // "terrazas y cubiertas" según su propia nota): un cambio de techo real
    // casi siempre incluye impermeabilización, así que es preciso, no un
    // ajuste cosmético para el matcher.
    tarea: { nombre: "Cambio de techo e impermeabilización", tiempo_acordado_dias: 3 },
  },
  {
    key: "pisos",
    emoji: "◻️",
    label: "Pisos de todo el nivel",
    // "Acabado de piso": mismo término que ya usa `tareasGenericas` más abajo
    // — resuelve rendimiento/fase en rendimientos.ts/fases-obra.ts (a
    // diferencia de un "Cambio de piso" genérico, que no matchea nada ahí).
    tarea: { nombre: "Acabado de piso", tiempo_acordado_dias: 3 },
  },
  {
    key: "pintura",
    emoji: "🎨",
    label: "Pintura general",
    tarea: { nombre: "Pintura general", tiempo_acordado_dias: 2 },
  },
];

/**
 * Expande las modificaciones generales seleccionadas (por `key`, ver
 * `MODIFICACIONES_GENERALES`) en una tarea por cada espacio del piso
 * recibido. Si `espaciosDelPiso` está vacío no hay nada que expandir: no
 * existe un "espacio piso completo" en el modelo de datos real (Proyecto →
 * Edificio → Piso → Unidad → Espacio → Tarea), así que la única forma de que
 * una modificación general "aplique a todo el piso" es que cada espacio del
 * piso reciba su propia copia de la tarea.
 */
export function expandirModificacionesGenerales(
  seleccionadas: string[],
  espaciosDelPiso: string[],
): { espacio: string; tarea: TareaSugerida }[] {
  const mods = MODIFICACIONES_GENERALES.filter((m) => seleccionadas.includes(m.key));
  const resultado: { espacio: string; tarea: TareaSugerida }[] = [];
  for (const espacio of espaciosDelPiso) {
    for (const mod of mods) {
      resultado.push({ espacio, tarea: { ...mod.tarea } });
    }
  }
  return resultado;
}
