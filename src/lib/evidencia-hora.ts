/**
 * Quién pone la hora de una evidencia: el SERVIDOR, no el teléfono.
 *
 * Lo que el producto promete es que la foto se tomó en el momento en que dice
 * que se tomó. Hasta ahora `timestamp_captura` llegaba de un `new Date()` del
 * navegador —o sea, del reloj del móvil, que el usuario cambia desde Ajustes—
 * y las rutas lo guardaban tal cual. La app presentaba como prueba una fecha
 * que el propio fotógrafo había elegido.
 *
 * La regla de este módulo:
 *
 *   - La hora que se GUARDA es la del reloj del servidor.
 *   - La hora que manda el cliente NO se guarda: sirve solo para COMPROBAR que
 *     la foto la fecha el SERVIDOR. La hora del dispositivo no se guarda
 *     nunca, y tampoco se usa para rechazar: el reloj no tumba un reporte.
 *   - La única excepción es la cola offline (ver abajo): ahí sí se guarda la
 *     hora declarada, pero la evidencia queda marcada como no verificada.
 *
 * El criterio de la ventana es el mismo que ya usa
 * `src/app/api/productos-tecnicos/acta/foto/route.ts`: quince minutos hacia
 * atrás —margen para una subida con mala señal, no para una foto de ayer— y
 * solo dos hacia adelante, porque una foto tomada «dentro de media hora» no es
 * un reloj desincronizado, es una fecha inventada.
 *
 * Módulo PURO a propósito: sin Prisma, sin `Date.now()` implícito (el instante
 * de referencia entra por parámetro). Así se verifica sin base de datos, que es
 * lo que hace `scripts/verificar-evidencia-hora.ts`.
 */

/** Cuánto puede haber tardado en llegar una evidencia tomada «ahora». */
export const MARGEN_PASADO_MS = 15 * 60 * 1000;
/** Desincronización de reloj tolerable hacia el futuro. Nada más. */
export const MARGEN_FUTURO_MS = 2 * 60 * 1000;
/**
 * Antigüedad máxima de una evidencia que llega DIFERIDA desde la cola offline.
 *
 * No es una ventana de confianza —lo diferido nunca se da por verificado— sino
 * un tope de sensatez: una foto que lleva más de una semana atrapada en el
 * teléfono ya no es el parte de avance de una tarea, y aceptarla convertiría la
 * cola en la puerta de atrás para cualquier fecha.
 */
export const MARGEN_DIFERIDO_MS = 7 * 24 * 60 * 60 * 1000;

/** Nombre del campo (form-data o JSON) con el que el cliente declara diferido. */
export const CAMPO_DIFERIDA = "diferida";

export type MotivoRechazoHora =
  | "HORA_ILEGIBLE"
  | "DEMASIADO_ANTIGUA"
  | "EN_EL_FUTURO"
  | "DIFERIDA_SIN_HORA"
  | "DIFERIDA_DEMASIADO_ANTIGUA";

export type HoraDeCaptura =
  | {
      ok: true;
      /** Lo que hay que escribir en `Evidencia.timestamp_captura`. */
      horaCaptura: Date;
      /** `true` si esa hora la puso el reloj del servidor, no el dispositivo. */
      verificadaPorServidor: boolean;
      /** `true` solo cuando se aceptó la hora declarada por venir de la cola. */
      diferida: boolean;
    }
  | { ok: false; motivo: MotivoRechazoHora; mensaje: string };

export interface EntradaHoraDeCaptura {
  /**
   * Lo que mandó el cliente. Llega en crudo (`FormDataEntryValue`, JSON, lo que
   * sea) y por eso el tipo es `unknown`: parsearlo es trabajo de aquí, no de
   * cada ruta.
   */
  declarada?: unknown;
  /** El reloj del servidor en el momento de atender la petición. */
  ahora: Date;
  /** La cola offline declarando que esto es una subida diferida. */
  diferida?: boolean;
}

type Declarada =
  | { estado: "ausente" }
  | { estado: "ilegible" }
  | { estado: "ok"; ms: number };

/**
 * Traduce lo que sea que haya mandado el cliente a milisegundos epoch.
 *
 * Distingue tres cosas que no son lo mismo: no mandó nada (legítimo), mandó
 * basura (sospechoso, se rechaza) y mandó un instante (se comprueba).
 */
function leerDeclarada(valor: unknown): Declarada {
  if (valor === null || valor === undefined) return { estado: "ausente" };

  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (limpio.length === 0) return { estado: "ausente" };
    const ms = Date.parse(limpio);
    return Number.isNaN(ms) ? { estado: "ilegible" } : { estado: "ok", ms };
  }

  if (typeof valor === "number") {
    // NaN e Infinity llegan solos si alguien hace `Number(campo)` sin mirar.
    return Number.isFinite(valor) ? { estado: "ok", ms: valor } : { estado: "ilegible" };
  }

  if (valor instanceof Date) {
    const ms = valor.getTime();
    return Number.isNaN(ms) ? { estado: "ilegible" } : { estado: "ok", ms };
  }

  // Un File, un objeto, un booleano: nadie manda eso por accidente.
  return { estado: "ilegible" };
}

/** Interpreta el campo `diferida` venga como booleano o como texto de form-data. */
export function leerMarcaDiferida(valor: unknown): boolean {
  if (valor === true) return true;
  if (typeof valor === "string") {
    const limpio = valor.trim().toLowerCase();
    return limpio === "true" || limpio === "1";
  }
  return false;
}

/**
 * Decide qué hora se guarda para una evidencia, o por qué no se guarda ninguna.
 *
 * Casos, en orden:
 *
 *  1. Sin hora declarada → se usa la del servidor. Sin drama: el cliente no
 *     afirmó nada, y lo que se escribe es el reloj de casa.
 *  2. Hora declarada dentro de la ventana → se guarda LA DEL SERVIDOR. La hora
 *     del cliente ya cumplió su único papel: demostrar que la foto es de ahora.
 *  3. Hora declarada fuera de la ventana → rechazo, con el motivo distinguido
 *     (pasado o futuro) para poder decirle al usuario qué mirar.
 *  4. Subida diferida (la cola offline lo dice explícitamente) → se guarda la
 *     hora DECLARADA, y `verificadaPorServidor` queda en `false`.
 *
 * Ojo con el caso 4: una subida marcada como diferida que resulta estar dentro
 * de la ventana en vivo se trata como lo que es —una subida en vivo— y se le
 * guarda la hora del servidor. Marcarse diferido no es un atajo para que te
 * acepten una hora propia; lo único que da es una evidencia peor, marcada como
 * no verificada.
 */
export function resolverHoraDeCaptura({
  declarada,
  ahora,
  diferida = false,
}: EntradaHoraDeCaptura): HoraDeCaptura {
  const referencia = Number.isNaN(ahora.getTime()) ? Date.now() : ahora.getTime();
  const leida = leerDeclarada(declarada);

  // --- Subida en vivo: manda el reloj del servidor, y punto --------------
  //
  // La hora que declara el cliente NO se mira siquiera. Rechazar por ella era
  // teatro: el que falsifica manda "ahora" y pasa, mientras que el contratista
  // honesto que tarda dieciseis minutos entre la primera foto y el envio
  // -video, notas, checklist- se queda sin poder reportar. El incentivo salia
  // exactamente del reves.
  //
  // Lo que cierra el fraude no es juzgar la hora ajena, es dejar de guardarla.
  if (!diferida) {
    return {
      ok: true,
      horaCaptura: new Date(referencia),
      verificadaPorServidor: true,
      diferida: false,
    };
  }

  // --- Subida diferida: la cola sin senal --------------------------------
  //
  // Aqui la hora del servidor mentiria al reves: una foto de hace seis horas
  // quedaria fechada ahora. Se guarda la que declara el dispositivo, que es lo
  // unico que hay, y se marca como NO verificada. Quien mire la evidencia tiene
  // que poder distinguir "el servidor vio llegar esto en el momento" de "esto
  // venia en una cola".
  const usable =
    leida.estado === "ok" &&
    leida.ms <= referencia + MARGEN_FUTURO_MS &&
    leida.ms >= referencia - MARGEN_DIFERIDO_MS;

  // Una hora ausente, ilegible o absurda -del futuro, o de hace meses- no se
  // rechaza: se cae al reloj del servidor. Sigue marcada como no verificada,
  // asi que no gana confianza por el camino, y el maestro del sotano no se
  // queda sin subir su trabajo por culpa de un reloj mal puesto.
  return {
    ok: true,
    horaCaptura: usable ? new Date(leida.ms) : new Date(referencia),
    verificadaPorServidor: false,
    diferida: true,
  };
}

export function horaVerificadaPorServidor(evidencia: {
  timestamp_captura: Date;
  created_at: Date;
}): boolean {
  const captura = evidencia.timestamp_captura.getTime();
  const creada = evidencia.created_at.getTime();
  if (Number.isNaN(captura) || Number.isNaN(creada)) return false;
  return Math.abs(creada - captura) <= MARGEN_PASADO_MS;
}
