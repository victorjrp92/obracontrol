import { estadoDeAcceso, type DatosSuscripcion } from "@/lib/suscripcion";

/**
 * A quién hay que avisarle hoy de que su plan se vence.
 *
 * Módulo PURO: no lee la base, no manda correos, no mira el reloj salvo por el
 * parámetro `ahora`. Así se puede verificar entero sin nada montado, que es como
 * está verificado en `scripts/verificar-avisos.ts`.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * La renovación aquí es MANUAL por diseño: en Colombia una empresa paga por
 * PSE, y PSE no admite cobro recurrente. Sin aviso, el flujo real es «se vence
 * → no puede crear obras → se enoja → escribe».
 *
 * ── Por qué NO hay columna de «último aviso enviado» ───────────────────────
 * Sería la forma obvia de no repetir el correo, y cuesta una migración. No hace
 * falta: se avisa solo en umbrales EXACTOS de días. Si la tarea corre una vez al
 * día, cada cuenta cruza cada umbral una sola vez, y la idempotencia sale de la
 * aritmética en vez de del esquema. El precio es que si la tarea no corre un
 * día, ese umbral se pierde — por eso hay varios y no uno.
 */

/**
 * Días restantes en los que se avisa. Con `0` se cubre el día en que vence.
 *
 * Tres antes de vencer y no uno solo: si la tarea falla un día, quedan otras
 * dos oportunidades antes de que la persona se quede sin poder crear obras.
 */
export const UMBRALES_AVISO = [7, 3, 1, 0] as const;

export interface CuentaParaAviso extends DatosSuscripcion {
  constructora_id: string;
}

export interface Aviso {
  constructora_id: string;
  diasRestantes: number;
  /** `true` el día en que vence o después. Cambia el tono del correo. */
  vencido: boolean;
}

/**
 * Decide si a una cuenta le toca aviso hoy.
 *
 * Devuelve `null` cuando no toca. Los planes gratuitos nunca vencen (su límite
 * es por número de obras) y las cuentas sin fecha son cortesías o socios: a
 * ninguna se le avisa de un vencimiento que no existe.
 */
export function avisoPara(cuenta: CuentaParaAviso, ahora: Date = new Date()): Aviso | null {
  if (cuenta.plan_suscripcion === "PERSONAL") return null;
  if (!cuenta.suscripcion_vence_el) return null;

  const acceso = estadoDeAcceso(cuenta, ahora);
  if (acceso.diasRestantes === null) return null;

  if (!UMBRALES_AVISO.includes(acceso.diasRestantes as (typeof UMBRALES_AVISO)[number])) {
    return null;
  }

  return {
    constructora_id: cuenta.constructora_id,
    diasRestantes: acceso.diasRestantes,
    vencido: acceso.diasRestantes <= 0,
  };
}

/** Los avisos que tocan hoy, de una lista de cuentas. */
export function avisosDeHoy(cuentas: CuentaParaAviso[], ahora: Date = new Date()): Aviso[] {
  return cuentas
    .map((c) => avisoPara(c, ahora))
    .filter((a): a is Aviso => a !== null);
}

/** Cómo se lee la fecha en el correo. Colombia, sin hora: es una fecha, no un instante. */
export function fechaLarga(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
