/**
 * Estado del consentimiento de cookies, compartido entre el banner y los
 * scripts que dependen de él.
 *
 * Antes el banner era decorativo: aceptar y rechazar guardaban una marca y no
 * activaban ni bloqueaban nada, porque no había analítica. Al entrar Microsoft
 * Clarity (grabaciones y mapas de calor) eso deja de ser aceptable — Clarity
 * exige modo de consentimiento para visitantes de la UE, Reino Unido y Suiza
 * desde octubre de 2025, y buena parte de nuestro público es la diáspora en
 * España. Así que el script NO se carga hasta que la persona acepta.
 *
 * `localStorage` (no cookie) para no crear una cookie con tal de recordar que
 * no quieren cookies.
 */

export const CLAVE_CONSENTIMIENTO = "seiricon-cookie-consent";

export type EstadoConsentimiento = "aceptado" | "rechazado" | "sin-responder";

/** Evento propio: el banner avisa, los scripts escuchan. */
export const EVENTO_CONSENTIMIENTO = "seiricon:consentimiento";

export function leerConsentimiento(): EstadoConsentimiento {
  if (typeof window === "undefined") return "sin-responder";
  try {
    const v = window.localStorage.getItem(CLAVE_CONSENTIMIENTO);
    // "accepted"/"declined" son los valores que ya guardó el banner anterior:
    // se respetan para no volver a preguntarle a quien ya respondió.
    if (v === "aceptado" || v === "accepted") return "aceptado";
    if (v === "rechazado" || v === "declined") return "rechazado";
    return "sin-responder";
  } catch {
    // Safari en modo privado puede lanzar al tocar localStorage.
    return "sin-responder";
  }
}

export function guardarConsentimiento(estado: Exclude<EstadoConsentimiento, "sin-responder">) {
  try {
    window.localStorage.setItem(CLAVE_CONSENTIMIENTO, estado);
  } catch {
    /* si no se puede guardar, el banner reaparecerá: preferible a fallar */
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMIENTO, { detail: estado }));
}
