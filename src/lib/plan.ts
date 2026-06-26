import type { PlanTipo, TipoCuenta } from "@/generated/prisma";

/**
 * ─── Capa de capacidades (fuente única de verdad del "modo simple") ──────────
 *
 * Aquí vive la decisión de QUÉ ve y QUÉ puede hacer cada perfil. Se consume
 * tanto en el front (ocultar menú/botones) como en el back (guardas de API),
 * para que ocultar no sea lo mismo que "no autorizar".
 *
 * Diseño: el comportamiento lo gobierna `tipo_cuenta` (CONSTRUCTORA / CONTRATISTA
 * / PROPIETARIO) y el cobro lo gobierna `plan_suscripcion`. Se mantienen
 * separados a propósito — un contratista puede subir de plan sin dejar de ser
 * contratista.
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
  | "modoSimple";    // usa la cáscara simple + módulo de intención (/empezar)

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
  },
};

/** ¿El perfil `tipo` tiene la capacidad `cap`? */
export function puede(tipo: TipoCuenta, cap: Capacidad): boolean {
  return MATRIZ[tipo]?.[cap] ?? false;
}

/** ¿Es una cuenta personal (contratista B2C o propietario) en modo simple? */
export function esCuentaPersonal(tipo: TipoCuenta): boolean {
  return tipo === "CONTRATISTA" || tipo === "PROPIETARIO";
}

/**
 * ¿El usuario puede crear y administrar obreros DIRECTOS (que cuelgan de él
 * mismo como `contratista_id`)? Cierto para:
 *   - CONTRATISTA (flujo de empresa de siempre).
 *   - ADMIN_GENERAL de una cuenta personal (contratista B2C/propietario): es su
 *     propio "dueño de obreros" y a la vez el aprobador.
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
  if (tipo === "CONTRATISTA") {
    return ["dashboard", "proyectos", "tareas", "equipo", "reportes", "configuracion"];
  }
  // PROPIETARIO
  return ["dashboard", "proyectos", "tareas", "equipo", "reportes", "configuracion"];
}

/**
 * Tope de obras ACTIVAS del plan gratis (freemium). `Infinity` = sin tope.
 * El tope se aplica solo a planes PERSONAL; los planes de pago no tienen límite.
 */
export function limiteObrasActivas(plan: PlanTipo, tipo: TipoCuenta): number {
  if (plan !== "PERSONAL") return Infinity;
  // Plan gratis: el propietario arranca con 1 obra; el contratista B2C con 2
  // clientes para que pruebe el flujo real antes de pasar a un plan de pago.
  return tipo === "CONTRATISTA" ? 2 : 1;
}

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
  if (tipo === "CONTRATISTA") {
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
