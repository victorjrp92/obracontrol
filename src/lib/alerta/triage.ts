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
 * REFINAMIENTO 2026-08-13 (ver docs/specs/2026-08-13-alerta-refinamiento-vision.md):
 *
 *   - R3 — el PATRÓN también tiene dos fuentes. Antes venía de una sola (la
 *     IA) y nadie lo contrastaba, aunque es lo que abre la única puerta al
 *     verde (regla 8: muro divisorio + craquelado). Ahora la persona
 *     confirma o corrige el patrón leído (`patron_declarado`), y se
 *     reconcilia con el MISMO mecanismo ya probado: NO hay tabla de
 *     severidad de patrones (la gravedad de un patrón depende del elemento
 *     — `diagonal` es rojo en columna y neutro en muro divisorio), sino que
 *     `aplicarCandidatoDescartado()` se generaliza y evalúa la observación
 *     bajo TODOS los candidatos (elemento declarado × observado, patrón
 *     observado × declarado), quedándose con el nivel más severo.
 *   - R4 — umbral asimétrico para el verde (`CONFIANZA_MINIMA_VERDE`).
 *
 * TypeScript puro, sin dependencias de UI ni de red.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase2.md, sección D3.
 */
import { COPY_NIVEL, QUE_NO_HACER_SI_NO_VERDE } from "./copys";
import { evaluarGrieta } from "./reglas";
import type { Elemento, Nivel, ObservacionGrieta, Patron, Veredicto } from "./tipos";

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
  /**
   * R3 — patrón que la persona CONFIRMÓ o CORRIGIÓ después de ver la lectura
   * de la IA (`ConfirmarPatron.tsx`). Opcional: si no viene (modo manual,
   * donde el patrón ya lo puso la persona, o cualquier caller viejo), no hay
   * nada que contrastar y el comportamiento es idéntico al de Fase 2.
   */
  patron_declarado?: Patron;
}

export interface ResultadoTriage {
  elemento: Elemento;
  hubo_discrepancia: boolean;
}

/**
 * R3 — resultado de contrastar el patrón leído por la IA con el que
 * confirmó la persona. A diferencia del elemento, acá NO se elige un
 * "ganador" por severidad: el patrón que se MUESTRA es siempre el observado
 * en la foto, y la discrepancia se paga con `confianza.patron = 0` +
 * la evaluación del patrón descartado en `aplicarCandidatoDescartado()`.
 */
export interface ResultadoTriagePatron {
  /** El patrón que se le muestra a la persona: siempre el observado en la foto. */
  patron: Patron;
  hubo_discrepancia: boolean;
}

export interface GrietaEvaluada {
  entrada: EntradaTriage;
  /** Resultado de T1: qué elemento ganó, y si hubo discrepancia entre lo declarado y lo observado. */
  reconciliacion: ResultadoTriage;
  /** R3 — si el patrón confirmado por la persona difiere del leído en la foto. */
  reconciliacion_patron: ResultadoTriagePatron;
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
 * R3 — contraste del patrón. No hay ranking de severidad (ver cabecera):
 * el patrón mostrado es SIEMPRE el observado en la foto; lo único que hace
 * esta función es marcar si la persona lo corrigió. Sin `declarado` (modo
 * manual o caller viejo) no hay discrepancia posible.
 */
export function reconciliarPatron(observado: Patron, declarado?: Patron): ResultadoTriagePatron {
  return { patron: observado, hubo_discrepancia: declarado !== undefined && declarado !== observado };
}

/**
 * T2 — la observación que de verdad se evalúa: mismos campos, elemento
 * reconciliado. Si hubo discrepancia, `confianza.elemento` baja a 0 — eso
 * solo puede activar la regla 7 de `reglas.ts` (amarillo), que corre DESPUÉS
 * de las reglas 1-6: nunca ablanda un rojo, y cierra el único hueco a verde
 * cuando usuario y modelo no se ponen de acuerdo. Ninguna regla nueva.
 *
 * R3 — mismo tratamiento para el patrón: si la persona corrigió el patrón
 * leído, `confianza.patron` baja a 0. El tercer parámetro es opcional para
 * no romper a ningún caller de Fase 2.
 */
export function construirObservacionEfectiva(
  observacion: ObservacionGrieta,
  resultado: ResultadoTriage,
  resultadoPatron?: ResultadoTriagePatron
): ObservacionGrieta {
  const confianza = { ...observacion.confianza };
  if (resultado.hubo_discrepancia) confianza.elemento = 0;
  if (resultadoPatron?.hubo_discrepancia) confianza.patron = 0;
  return { ...observacion, elemento: resultado.elemento, confianza };
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
 * Red de seguridad de T1/T2 (ver HALLAZGO en la cabecera del archivo),
 * GENERALIZADA a patrones en R3. Evalúa la MISMA observación bajo todos los
 * candidatos posibles —elemento declarado × elemento observado, patrón
 * observado × patrón declarado por la persona— con la confianza tal cual la
 * reportó la fuente (sin zeroing), y se queda con el nivel más severo.
 *
 * Nunca cambia el elemento ni el patrón que se le muestran al usuario, y
 * `elevar()` solo sube: por construcción, el nivel final es >= el de leer la
 * observación bajo CUALQUIER candidato (invariante de monotonía extendido,
 * verificado con un barrido en `scripts/verificar-triage-alerta.ts`).
 *
 * Sin discrepancias, el conjunto de candidatos es un solo par y esta función
 * no puede cambiar nada (evalúa la misma observación que ya evaluó T2, con
 * una confianza que solo puede ser igual o mayor).
 */
function aplicarCandidatoDescartado(veredicto: Veredicto, entrada: EntradaTriage): Veredicto {
  const elementos: Elemento[] =
    entrada.declarado === entrada.observacion.elemento ? [entrada.declarado] : [entrada.declarado, entrada.observacion.elemento];
  const patrones: Patron[] =
    entrada.patron_declarado === undefined || entrada.patron_declarado === entrada.observacion.patron
      ? [entrada.observacion.patron]
      : [entrada.observacion.patron, entrada.patron_declarado];

  let resultado = veredicto;
  for (const elemento of elementos) {
    for (const patron of patrones) {
      const alternativo = evaluarGrieta({ ...entrada.observacion, elemento, patron });
      resultado = elevar(
        resultado,
        alternativo.nivel,
        "la foto, leída con el elemento o el patrón que no ganó la reconciliación, da un resultado más severo — se usa el más conservador"
      );
    }
  }
  return resultado;
}

/**
 * R4 — umbral asimétrico para el verde. Deliberadamente MÁS ALTO que
 * `CONFIANZA_MINIMA = 0.6` de `reglas.ts`: el verde es el único veredicto
 * que puede hacer daño por omisión (rojo y amarillo, si se equivocan, solo
 * mandan a alguien a que un ingeniero lo revise; un verde equivocado manda a
 * alguien a dormir bajo una columna partida). Vive acá, en la capa de
 * triage: `reglas.ts` no se toca.
 */
export const CONFIANZA_MINIMA_VERDE = 0.85;

/**
 * R4 — si el veredicto es verde y la confianza del elemento O la del patrón
 * está por debajo de `CONFIANZA_MINIMA_VERDE`, sube a amarillo. Solo eleva
 * (usa `elevar()`), nunca ablanda.
 */
function aplicarUmbralVerde(veredicto: Veredicto, observacionEfectiva: ObservacionGrieta): Veredicto {
  if (veredicto.nivel !== "verde") return veredicto;
  const { elemento, patron } = observacionEfectiva.confianza;
  if (elemento >= CONFIANZA_MINIMA_VERDE && patron >= CONFIANZA_MINIMA_VERDE) return veredicto;
  return elevar(
    veredicto,
    "amarillo",
    "la lectura de la foto no alcanza la confianza que exigimos para no ver señales de alarma — se documenta igual"
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
 * Evalúa UNA grieta de punta a punta: reconcilia el elemento (T1/T2) y el
 * patrón (R3), corre `evaluarGrieta()` sobre la observación efectiva, y
 * aplica las elevaciones de candidatos descartados, umbral del verde (R4),
 * pasante (T3) y fuente manual (T4), en ese orden. Cada paso solo puede
 * subir el nivel, nunca bajarlo (invariante verificado en
 * scripts/verificar-triage-alerta.ts).
 */
export function evaluarTriageGrieta(entrada: EntradaTriage): GrietaEvaluada {
  const reconciliacion = reconciliarElemento(entrada.declarado, entrada.observacion.elemento);
  const reconciliacion_patron = reconciliarPatron(entrada.observacion.patron, entrada.patron_declarado);
  const observacionEfectiva = construirObservacionEfectiva(entrada.observacion, reconciliacion, reconciliacion_patron);

  let veredicto = evaluarGrieta(observacionEfectiva);
  veredicto = aplicarCandidatoDescartado(veredicto, entrada);
  veredicto = aplicarUmbralVerde(veredicto, observacionEfectiva);
  veredicto = aplicarPasante(veredicto, entrada, observacionEfectiva.elemento);
  veredicto = aplicarFuenteManual(veredicto, entrada.fuente);

  return { entrada, reconciliacion, reconciliacion_patron, observacionEfectiva, veredicto };
}
