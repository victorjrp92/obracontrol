import type { PlanTipo, TipoCuenta } from "@/generated/prisma";

/**
 * ─── Capa de capacidades (fuente única de verdad del "modo simple") ──────────
 *
 * Aquí vive la decisión de QUÉ ve y QUÉ puede hacer cada perfil. Se consume
 * tanto en el front (ocultar menú/botones) como en el back (guardas de API),
 * para que ocultar no sea lo mismo que "no autorizar".
 *
 * Diseño: el comportamiento lo gobierna `tipo_cuenta` (CONSTRUCTORA /
 * CONTRATISTA / PROPIETARIO / ARQUITECTO) y el cobro lo gobierna
 * `plan_suscripcion`. Se mantienen separados a propósito — un contratista puede
 * subir de plan sin dejar de ser contratista.
 */

export type Capacidad =
  | "contratistas"   // gestionar contratistas (sub-equipos que reportan)
  | "obreros"        // gestionar obreros directos
  | "equipo"         // gestionar su propio equipo (obreros) en modo simple
  | "clientes"       // manejar clientes/terceros dueños de la obra
  | "multiproyecto"  // varias obras a la vez
  | "pagos"          // pagos, retegarantía, cortes
  | "usuarios"       // invitar usuarios y administrar roles
  | "sugerencias"    // bandeja de tareas sugeridas
  | "empresa"        // ficha/pestaña de empresa
  | "reportes"       // reportes y exportables
  | "validar"        // aprobar/rechazar lo reportado
  | "modoSimple"     // usa la cáscara simple + módulo de intención (/empezar)
  | "productosTecnicos"; // planos, renders, registro inicial y actas firmadas

/**
 * Todas las capacidades, en orden estable. Existe para poder recorrer la matriz
 * (verificación, depuración) sin volver a escribir la lista en cada consumidor.
 */
export const CAPACIDADES: readonly Capacidad[] = [
  "contratistas",
  "obreros",
  "equipo",
  "clientes",
  "multiproyecto",
  "pagos",
  "usuarios",
  "sugerencias",
  "empresa",
  "reportes",
  "validar",
  "modoSimple",
  "productosTecnicos",
];

/** Matriz de capacidades por tipo de cuenta. */
const MATRIZ: Record<TipoCuenta, Record<Capacidad, boolean>> = {
  // Empresa: todo habilitado (comportamiento actual, sin cambios).
  CONSTRUCTORA: {
    contratistas: true,
    obreros: true,
    equipo: false,
    clientes: true,
    multiproyecto: true,
    pagos: true,
    usuarios: true,
    sugerencias: true,
    empresa: true,
    reportes: true,
    validar: true,
    modoSimple: false,
    productosTecnicos: true,
  },
  // Contratista B2C: emprendedor de oficio; maneja varias obras de varios
  // clientes, arma su propio equipo/personal que le reporta, y valida lo reportado.
  CONTRATISTA: {
    contratistas: true,
    obreros: true,
    equipo: true,
    clientes: true,
    multiproyecto: true,
    pagos: true,
    usuarios: false,
    sugerencias: true,
    empresa: false,
    reportes: true,
    validar: true,
    modoSimple: true,
    productosTecnicos: false,
  },
  // Propietario (persona natural): lleva su propia obra y contrata obreros
  // directos que le reportan para validar. Sin contratistas, clientes ni pagos.
  PROPIETARIO: {
    contratistas: false,
    obreros: true,
    equipo: true,
    clientes: false,
    multiproyecto: true,
    pagos: false,
    usuarios: false,
    sugerencias: false,
    empresa: false,
    reportes: true,
    validar: true,
    modoSimple: true,
    productosTecnicos: false,
  },
  // Arquitecto: profesional que diseña y supervisa. Como el contratista, maneja
  // varias obras de varios clientes y valida lo reportado — pero su entregable
  // no es la ejecución, son los productos técnicos: planos, renders, registro
  // fotográfico inicial y actas firmadas con su matrícula. Es lo único que lo
  // distingue en la matriz, y es lo que justifica su plan aparte.
  ARQUITECTO: {
    contratistas: true,
    obreros: true,
    equipo: true,
    clientes: true,
    multiproyecto: true,
    pagos: true,
    usuarios: false,
    sugerencias: true,
    empresa: false,
    reportes: true,
    validar: true,
    modoSimple: true,
    productosTecnicos: true,
  },
};

/** ¿El perfil `tipo` tiene la capacidad `cap`? */
export function puede(tipo: TipoCuenta, cap: Capacidad): boolean {
  return MATRIZ[tipo]?.[cap] ?? false;
}

/**
 * La fila entera de la matriz para un perfil. Se devuelve una copia: la matriz
 * gobierna guardas de API, así que no se presta la referencia viva.
 */
export function capacidadesDe(tipo: TipoCuenta): Readonly<Record<Capacidad, boolean>> {
  return { ...MATRIZ[tipo] };
}

/**
 * ¿Es una cuenta personal en modo simple? Lo son los tres perfiles B2C:
 * contratista, propietario y arquitecto.
 */
export function esCuentaPersonal(tipo: TipoCuenta): tipo is TipoCuentaPersonal {
  return tipo === "CONTRATISTA" || tipo === "PROPIETARIO" || tipo === "ARQUITECTO";
}

/** Los tipos de cuenta B2C: negocio o vivienda propia, en modo simple. */
export type TipoCuentaPersonal = Extract<TipoCuenta, "CONTRATISTA" | "PROPIETARIO" | "ARQUITECTO">;

/**
 * ¿El usuario puede crear y administrar obreros DIRECTOS (que cuelgan de él
 * mismo como `contratista_id`)? Cierto para:
 *   - CONTRATISTA (flujo de empresa de siempre).
 *   - ADMIN_GENERAL de una cuenta personal (contratista B2C, propietario o
 *     arquitecto): es su propio "dueño de obreros" y a la vez el aprobador.
 */
export function puedeGestionarEquipoDirecto(nivel: string, tipo: TipoCuenta): boolean {
  if (nivel === "CONTRATISTA") return true;
  if (nivel === "ADMIN_GENERAL" && esCuentaPersonal(tipo)) return true;
  return false;
}

/**
 * Items del sidebar que el perfil personal debe ver, en orden. Solo claves de
 * rutas reales y funcionales (la gestión de equipo vive DENTRO del proyecto,
 * no como pestaña suelta). Las claves coinciden con `allNavItems` en Sidebar.
 */
export function modulosVisibles(tipo: TipoCuenta): string[] {
  if (tipo === "CONSTRUCTORA") {
    // No se usa: la empresa delega en getPermissions(). Valor de respaldo.
    return ["dashboard", "empresa", "proyectos", "tareas", "sugerencias", "reportes", "usuarios", "configuracion"];
  }
  // Los tres perfiles personales (CONTRATISTA, PROPIETARIO, ARQUITECTO) ven la
  // misma cáscara simple. Los productos técnicos del arquitecto viven DENTRO de
  // la obra, igual que la gestión de equipo, así que no añaden ítem aquí.
  return ["dashboard", "proyectos", "tareas", "equipo", "reportes", "configuracion"];
}

/**
 * Tope de obras ACTIVAS según el plan.
 *
 * Vive ahora en `src/lib/suscripcion.ts`, junto a los precios: el tope y lo que
 * cuesta cada plan son la misma decisión comercial y no deben poder divergir.
 *
 * La versión anterior devolvía `Infinity` para todo lo que no fuera PERSONAL,
 * así que los tres planes de pago no tenían tope — y como el registro creaba
 * cada cuenta en PROYECTO, en la práctica todo el mundo tenía obras ilimitadas
 * gratis. Se reexporta para no romper a quien ya la importaba de aquí.
 */
// El tope de obras y los tramos de precio viven en `suscripcion.ts`, junto a lo
// que cuesta cada plan: son la misma decisión comercial y no deben divergir. Se
// reexportan aquí para no romper a quien ya los importaba de `plan.ts`.
export {
  limiteObrasActivas,
  tramoPorObrasActivas,
  TRAMOS_OBRAS_ACTIVAS,
  type TramoObras,
  type TramoObrasKey,
} from "@/lib/suscripcion";

/**
 * Copys/labels dependientes del perfil. Centralizar el tono aquí evita
 * salpicar condicionales de texto por toda la UI.
 */
export interface TonoPerfil {
  /** A quién contrata y reporta: define etiquetas del equipo. */
  equipoLabel: string;        // "Mis obreros" | "Mis contratistas"
  equipoSingular: string;     // "obrero" | "contratista"
  obraLabel: string;          // "Mi obra" | "Las obras"
  obraSingular: string;       // "obra" | "proyecto"
  /** Saludo/encabezado del módulo de intención. */
  intencionTitulo: string;
  intencionSubtitulo: string;
}

export function tonoPerfil(tipo: TipoCuenta): TonoPerfil {
  // El arquitecto comparte el tono del contratista: los dos trabajan varias
  // obras de varios clientes y coordinan a quien ejecuta. Lo que los distingue
  // son los productos técnicos, no cómo se les nombra la obra ni el equipo.
  if (tipo === "CONTRATISTA" || tipo === "ARQUITECTO") {
    return {
      equipoLabel: "Mis contratistas",
      equipoSingular: "contratista",
      obraLabel: "Mis obras",
      obraSingular: "obra",
      intencionTitulo: "Empecemos tu obra",
      intencionSubtitulo: "Te hago unas preguntas rápidas y te la dejo lista.",
    };
  }
  if (tipo === "PROPIETARIO") {
    return {
      equipoLabel: "Mis obreros",
      equipoSingular: "obrero",
      obraLabel: "Mi obra",
      obraSingular: "obra",
      intencionTitulo: "Empecemos con tu obra",
      intencionSubtitulo: "Cuéntame qué quieres hacer y la armamos juntos, sin enredos.",
    };
  }
  // CONSTRUCTORA (no usa el módulo de intención, pero damos valores razonables)
  return {
    equipoLabel: "Contratistas",
    equipoSingular: "contratista",
    obraLabel: "Proyectos",
    obraSingular: "proyecto",
    intencionTitulo: "Nuevo proyecto",
    intencionSubtitulo: "Configura tu proyecto paso a paso.",
  };
}
