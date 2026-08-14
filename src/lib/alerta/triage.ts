/**
 * Capa de reconciliación entre lo que declara la persona en el Paso 1
 * (`UbicarGrieta.tsx`) y lo que observa el modelo de visión (o lo que la
 * persona describe a mano cuando la IA está apagada). Esto NO es un segundo
 * motor de reglas: el veredicto SIEMPRE sale de `evaluarGrieta()`
 * (`reglas.ts`); esta capa solo decide QUÉ observación entra a esa función
 * (T1/T2) y aplica, después, un puñado de elevaciones explícitas (T3/T4) que
 * nunca ablandan un nivel — solo lo suben.
 *
 * Invariante duro de todo este archivo, verificado en
 * `scripts/verificar-triage-alerta.ts`:
 *
 *   RANGO(evaluarTriageGrieta(e).veredicto.nivel) >= RANGO(evaluarGrieta(e.observacion).nivel)
 *
 * T3 (grieta pasante) es una interpretación de negocio marcada
 * explícitamente abajo, PENDIENTE de visto bueno de un ingeniero — igual
 * que las interpretaciones de las reglas 4 y 6 en `reglas.ts` (Fase 1).
 *
 * HALLAZGO para revisión de ingeniero (mismo tratamiento que T3): la tabla
 * `SEVERIDAD_ELEMENTO` de T1 NO es una garantía matemática de que "el
 * elemento con mayor severidad" produzca siempre el semáforo más severo para
 * CUALQUIER combinación de ancho/patrón/banderas — lo es en la mayoría de
 * los casos, pero no en todos. Ejemplo real encontrado al escribir
 * `scripts/verificar-triage-alerta.ts`: declarado=`muro_carga` con
 * `ancho_mm=5` (regla 4 de reglas.ts → rojo), observado por error como
 * `columna` (severidad 4 > 3) — si T1/T2 se quedaran solos, el elemento
 * ganador pasaría a `columna`, cuyas reglas no miran `ancho_mm`, y el
 * resultado se ablandaría a amarillo. `aplicarCandidatoDescartado()` de
 * abajo es una red de seguridad ADITIVA que cierra ese hueco sin tocar
 * `reglas.ts` ni la tabla/mecanismo de T1 tal como está aprobada: evalúa
 * también la observación bajo el elemento que NO ganó la reconciliación, y
 * si esa lectura es más severa, sube el nivel (nunca cambia el elemento
 * mostrado, que sigue siendo el de T1) con una razón genérica.
 *
 * TypeScript puro, sin dependencias de UI ni de red.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md, sección D3.
 */
import { COPY_NIVEL, QUE_NO_HACER_SI_NO_VERDE } from "./copys";
import { evaluarGrieta } from "./reglas";
import type { Elemento, Nivel, ObservacionGrieta, Veredicto } from "./tipos";

/**
 * T1 — ranking de severidad por elemento (spec D3): gana, en una
 * discrepancia, el elemento que produzca el semáforo más conservador.
 * Derivado de leer `reglas.ts`: columna/viga/nudo nunca llegan a verde (rojo
 * por reglas 1-2, si no amarillo por la 5); muro_carga tampoco (rojo por la
 * 4, si no amarillo por la 5) pero sin la vía diagonal→rojo de los primeros;
 * no_determinado/losa_techo/piso/fachada tampoco llegan a verde (rojo por la
 * 3 si hay banderas, si no amarillo por la 7/9); muro_divisorio es el ÚNICO
 * con camino a verde (regla 8).
 */
export const SEVERIDAD_ELEMENTO: Record<Elemento, number> = {
  columna: 4,
  viga: 4,
  nudo_viga_columna: 4,
  muro_carga: 3,
  no_determinado: 2,
  losa_techo: 2,
  piso: 2,
  fachada: 2,
  muro_divisorio: 1,
};

/** De dónde salió la `ObservacionGrieta`: de la IA, o de que la persona la describió a mano (D4). */
export type FuenteObservacion = "ia" | "manual";

/** Respuesta a "¿se ve la misma grieta del otro lado de la pared?" (T3). */
export type RespuestaPasante = "si" | "no" | "no_se";

export interface EntradaTriage {
  /** Elemento elegido por la persona en el Paso 1 (`UbicarGrieta.tsx`). */
  declarado: Elemento;
  /** Observación de la IA, o la armada a mano en modo manual (D4). */
  observacion: ObservacionGrieta;
  fuente: FuenteObservacion;
  pasante: RespuestaPasante;
}

export interface ResultadoTriage {
  elemento: Elemento;
  hubo_discrepancia: boolean;
}

export interface GrietaEvaluada {
  entrada: EntradaTriage;
  /** Resultado de T1: qué elemento ganó, y si hubo discrepancia entre lo declarado y lo observado. */
  reconciliacion: ResultadoTriage;
  /** T2 — la observación que de verdad consumió `evaluarGrieta()`. */
  observacionEfectiva: ObservacionGrieta;
  veredicto: Veredicto;
}

/**
 * T1 — gana el elemento que produzca el semáforo más conservador (mayor
 * `SEVERIDAD_ELEMENTO`). Empate → gana lo declarado por el usuario.
 */
export function reconciliarElemento(declarado: Elemento, observado: Elemento): ResultadoTriage {
  if (declarado === observado) {
    return { elemento: declarado, hubo_discrepancia: false };
  }
  const elemento = SEVERIDAD_ELEMENTO[observado] > SEVERIDAD_ELEMENTO[declarado] ? observado : declarado;
  return { elemento, hubo_discrepancia: true };
}

/**
 * T2 — la observación que de verdad se evalúa: mismos campos, elemento
 * reconciliado. Si hubo discrepancia, `confianza.elemento` baja a 0 — eso
 * solo puede activar la regla 7 de `reglas.ts` (amarillo), que corre DESPUÉS
 * de las reglas 1-6: nunca ablanda un rojo, y cierra el único hueco a verde
 * cuando usuario y modelo no se ponen de acuerdo. Ninguna regla nueva.
 */
export function construirObservacionEfectiva(
  observacion: ObservacionGrieta,
  resultado: ResultadoTriage
): ObservacionGrieta {
  return {
    ...observacion,
    elemento: resultado.elemento,
    confianza: resultado.hubo_discrepancia
      ? { ...observacion.confianza, elemento: 0 }
      : observacion.confianza,
  };
}

const RANGO_NIVEL: Record<Nivel, number> = { verde: 0, amarillo: 1, rojo: 2 };

/** Sube el veredicto al nivel dado SOLO si es más severo que el actual. Nunca ablanda. */
function elevar(veredicto: Veredicto, nivel: Nivel, razon: string): Veredicto {
  if (RANGO_NIVEL[nivel] <= RANGO_NIVEL[veredicto.nivel]) return veredicto;
  return {
    nivel,
    razon,
    que_hacer: COPY_NIVEL[nivel],
    que_no_hacer: nivel === "verde" ? [] : QUE_NO_HACER_SI_NO_VERDE,
  };
}

/**
 * T3 — grieta pasante. `Banderas` (reglas.ts/tipos.ts) NO se toca: no hay
 * campo "pasante" en ese contrato y no se inventa uno ahí. `pasante` es
 * puramente una entrada de esta capa, con UNA SOLA elevación posible:
 *
 *   - pasante="si" + elemento final=muro_carga + patrón=escalonada → rojo.
 *   - pasante="si" + el nivel ya calculado era verde → amarillo.
 *   - cualquier otro caso → sin efecto.
 *
 * PENDIENTE de visto bueno de un ingeniero (ver cabecera del archivo).
 */
function aplicarPasante(veredicto: Veredicto, entrada: EntradaTriage, elementoFinal: Elemento): Veredicto {
  if (entrada.pasante !== "si") return veredicto;

  if (elementoFinal === "muro_carga" && entrada.observacion.patron === "escalonada") {
    return elevar(veredicto, "rojo", "grieta pasante en muro de carga con patrón escalonado");
  }
  if (veredicto.nivel === "verde") {
    return elevar(veredicto, "amarillo", "se reportó como grieta pasante — no puede resolver en verde");
  }
  return veredicto;
}

/**
 * Red de seguridad de T1/T2 (ver HALLAZGO en la cabecera del archivo). Si
 * hubo discrepancia, evalúa la MISMA observación bajo el elemento que NO
 * ganó la reconciliación (con la confianza tal cual la reportó la fuente,
 * sin zeroing) y, si esa lectura alternativa es más severa que la efectiva,
 * sube el nivel — nunca cambia `reconciliacion.elemento` ni el elemento
 * mostrado al usuario. Sin efecto si no hubo discrepancia.
 */
function aplicarCandidatoDescartado(veredicto: Veredicto, entrada: EntradaTriage, reconciliacion: ResultadoTriage): Veredicto {
  if (!reconciliacion.hubo_discrepancia) return veredicto;

  const elementoDescartado =
    reconciliacion.elemento === entrada.declarado ? entrada.observacion.elemento : entrada.declarado;
  const veredictoDescartado = evaluarGrieta({ ...entrada.observacion, elemento: elementoDescartado });

  return elevar(
    veredicto,
    veredictoDescartado.nivel,
    "la foto, leída con el elemento que no ganó la reconciliación, da un resultado más severo — se usa el más conservador"
  );
}

/**
 * T4 — fuente manual nunca resuelve en verde: si la persona describió la
 * grieta a mano (sin IA) y `evaluarGrieta` dio verde, sube a amarillo con
 * una razón explícita.
 */
function aplicarFuenteManual(veredicto: Veredicto, fuente: FuenteObservacion): Veredicto {
  if (fuente !== "manual" || veredicto.nivel !== "verde") return veredicto;
  return elevar(veredicto, "amarillo", "lo describiste tú; ninguna lectura de la foto lo confirmó");
}

/**
 * Evalúa UNA grieta de punta a punta: reconcilia el elemento (T1/T2), corre
 * `evaluarGrieta()` sobre la observación efectiva, y aplica las elevaciones
 * de pasante (T3) y fuente manual (T4), en ese orden. Cada paso solo puede
 * subir el nivel, nunca bajarlo (invariante verificado en
 * scripts/verificar-triage-alerta.ts).
 */
export function evaluarTriageGrieta(entrada: EntradaTriage): GrietaEvaluada {
  const reconciliacion = reconciliarElemento(entrada.declarado, entrada.observacion.elemento);
  const observacionEfectiva = construirObservacionEfectiva(entrada.observacion, reconciliacion);

  let veredicto = evaluarGrieta(observacionEfectiva);
  veredicto = aplicarCandidatoDescartado(veredicto, entrada, reconciliacion);
  veredicto = aplicarPasante(veredicto, entrada, observacionEfectiva.elemento);
  veredicto = aplicarFuenteManual(veredicto, entrada.fuente);

  return { entrada, reconciliacion, observacionEfectiva, veredicto };
}
