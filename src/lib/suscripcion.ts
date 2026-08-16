import type { EstadoSuscripcion, PlanTipo, TipoCuenta } from "@/generated/prisma";

/**
 * ─── Suscripciones: qué cuesta cada plan y cuándo deja de valer ─────────────
 *
 * Fuente única de la verdad comercial. Antes esto no existía y el resultado era
 * que `plan_suscripcion` era un enum decorativo: `provisionarUsuario` le ponía
 * PROYECTO a toda cuenta nueva —el plan de $1.500.000/mes— y `limiteObrasActivas`
 * solo topaba PERSONAL, así que devolvía Infinity para todo lo demás. Producto
 * completo, gratis, sin vencimiento y sin que nadie lo hubiera decidido.
 *
 * Separación deliberada, la misma que ya usa `src/lib/plan.ts`:
 *   - `tipo_cuenta`      → QUÉ ve la persona (empresa / contratista / propietario)
 *   - `plan_suscripcion` → CUÁNTO puede hacer y cuánto paga
 *   - `estado_suscripcion` + `suscripcion_vence_el` → SI puede hacerlo hoy
 *
 * Los precios son los publicados en `src/components/landing-v2/Precios.tsx`. Si
 * cambian allá, cambian aquí: son el mismo número y no deben divergir.
 */

/** Días de prueba de una cuenta nueva. La landing promete 14. */
export const DIAS_PRUEBA = 14;

export interface DefinicionPlan {
  /** Precio mensual en CENTAVOS de COP. Wompi trabaja en centavos: evita redondeos. */
  precioCentavos: number;
  /** Obras ACTIVAS simultáneas. `Infinity` = sin tope. */
  limiteObras: number;
  nombre: string;
}

/**
 * PERSONAL es el plan gratuito de las cuentas B2C. Su tope real depende además
 * del `tipo_cuenta` (ver `limiteObrasActivas`), porque un contratista necesita
 * más de una obra para que el producto tenga sentido y un propietario no.
 */
export const PLANES: Record<PlanTipo, DefinicionPlan> = {
  PERSONAL: { precioCentavos: 0, limiteObras: 1, nombre: "Personal" },
  OBRA: { precioCentavos: 650_000_00, limiteObras: 1, nombre: "Obra" },
  PROYECTO: { precioCentavos: 1_500_000_00, limiteObras: 5, nombre: "Proyecto" },
  EMPRESA: { precioCentavos: 3_500_000_00, limiteObras: 15, nombre: "Empresa" },
};

/** Planes que se pueden comprar. PERSONAL es el gratuito: no se cobra. */
export const PLANES_DE_PAGO: PlanTipo[] = ["OBRA", "PROYECTO", "EMPRESA"];

export function esPlanDePago(plan: PlanTipo): boolean {
  return PLANES_DE_PAGO.includes(plan);
}

/** Formatea centavos como pesos colombianos, para UI y correos. */
export function formatearCOP(centavos: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

/**
 * Tope de obras ACTIVAS. Reemplaza a `limiteObrasActivas` de `src/lib/plan.ts`,
 * que solo miraba PERSONAL y dejaba el resto en Infinity.
 *
 * En el plan gratuito el contratista arranca con 2 clientes y el propietario con
 * 1: es la diferencia mínima para que cada uno pueda probar su flujo real.
 */
export function limiteObrasActivas(plan: PlanTipo, tipo: TipoCuenta): number {
  if (plan === "PERSONAL") return tipo === "CONTRATISTA" ? 2 : 1;
  return PLANES[plan].limiteObras;
}

// ─── Vigencia ───────────────────────────────────────────────────────────────

export interface EstadoAcceso {
  /** ¿Puede usar las funciones que consumen plan (crear obras, invitar)? */
  permite: boolean;
  motivo: "prueba" | "activa" | "vencida" | "cancelada" | "gratuito";
  /** Días que faltan para que venza. `null` si no vence. Negativo = ya venció. */
  diasRestantes: number | null;
  /** Verdadero en los últimos días de la prueba: dispara el aviso en la UI. */
  porVencer: boolean;
}

/** Umbral para empezar a avisar que se acaba. */
const DIAS_AVISO = 3;

export interface DatosSuscripcion {
  plan_suscripcion: PlanTipo;
  estado_suscripcion: EstadoSuscripcion;
  suscripcion_vence_el: Date | null;
}

/**
 * Única función que decide si una cuenta puede seguir usando el producto.
 *
 * Reglas, en orden:
 *   1. El plan PERSONAL (gratuito) nunca vence — se limita por cantidad de
 *      obras, no por tiempo.
 *   2. Sin fecha de vencimiento, se confía en el estado. Es la puerta para
 *      cuentas de cortesía, socios y demos, que se ponen ACTIVA sin fecha.
 *   3. Con fecha, manda la fecha: pasada, no permite, sin importar el estado.
 *   4. CANCELADA sigue valiendo hasta que venza — ya lo pagó.
 *
 * `ahora` es un parámetro para poder probar la función sin depender del reloj.
 */
export function estadoDeAcceso(c: DatosSuscripcion, ahora: Date = new Date()): EstadoAcceso {
  if (c.plan_suscripcion === "PERSONAL") {
    return { permite: true, motivo: "gratuito", diasRestantes: null, porVencer: false };
  }

  if (!c.suscripcion_vence_el) {
    const permite = c.estado_suscripcion === "ACTIVA" || c.estado_suscripcion === "PRUEBA";
    return {
      permite,
      motivo: permite ? "activa" : "vencida",
      diasRestantes: null,
      porVencer: false,
    };
  }

  const ms = c.suscripcion_vence_el.getTime() - ahora.getTime();
  const diasRestantes = Math.ceil(ms / 86_400_000);
  const vigente = ms > 0;

  if (!vigente) {
    return {
      permite: false,
      motivo: c.estado_suscripcion === "CANCELADA" ? "cancelada" : "vencida",
      diasRestantes,
      porVencer: false,
    };
  }

  return {
    permite: true,
    motivo: c.estado_suscripcion === "PRUEBA" ? "prueba" : "activa",
    diasRestantes,
    porVencer: diasRestantes <= DIAS_AVISO,
  };
}

/** Fecha de fin de la prueba de una cuenta que se crea ahora. */
export function finDePrueba(desde: Date = new Date()): Date {
  const fin = new Date(desde);
  fin.setDate(fin.getDate() + DIAS_PRUEBA);
  return fin;
}

/**
 * Nueva fecha de vencimiento al aprobarse un pago.
 *
 * Si la suscripción sigue vigente, el período nuevo se ENCADENA al final del
 * actual en vez de empezar hoy: quien renueva antes de tiempo no pierde los días
 * que le quedaban. Si ya venció, arranca hoy.
 */
export function extenderVigencia(
  venceActual: Date | null,
  periodoMeses: number,
  ahora: Date = new Date()
): Date {
  const base = venceActual && venceActual > ahora ? new Date(venceActual) : new Date(ahora);
  base.setMonth(base.getMonth() + periodoMeses);
  return base;
}

/** Precio total de un plan por N meses, en centavos. */
export function precioTotalCentavos(plan: PlanTipo, periodoMeses: number): number {
  return PLANES[plan].precioCentavos * periodoMeses;
}
