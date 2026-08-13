/**
 * Motor de reglas fijas (AIS/NSR-10 Título A + ATC-20), Fase 1 sin IA. Traduce
 * una observación estructurada de una grieta (`ObservacionGrieta` — lo que en
 * Fase 2 llenará un modelo de visión) a un veredicto rojo/amarillo/verde.
 *
 * NO hay pesos, promedios ni "score": es una tabla de condiciones en orden, y
 * la PRIMERA que aplica gana. El código de abajo sigue el mismo orden 1→9 de
 * la tabla A.2 del spec, un bloque `if` por fila, comentado con el número de
 * regla para poder cotejarlo línea a línea contra el spec.
 *
 * Dos interpretaciones no literales de la tabla (marcadas explícitamente
 * abajo, reglas 4 y 6): el contrato `Banderas` no tiene un campo "pasante" ni
 * "riesgo de desprendimiento" — se usa `desplazamiento_caras` como proxy en
 * ambos casos, por ser la única bandera que describe un desfase visible entre
 * las caras de la grieta. Un ingeniero debe confirmar esta interpretación.
 *
 * Ver docs/specs/2026-08-13-seiricon-alerta-fase1.md, secciones A.2 y A.3.
 */
import type { Banderas, Elemento, Nivel, ObservacionGrieta, Patron, Veredicto } from "./tipos";
import { COPY_NIVEL, QUE_NO_HACER_SI_NO_VERDE } from "./copys";

/** A.3 — por debajo de este umbral (estrictamente, `< `), una observación nunca resuelve en verde. */
export const CONFIANZA_MINIMA = 0.6;

const ELEMENTOS_CON_RIESGO_ESTRUCTURAL: Elemento[] = ["columna", "viga", "nudo_viga_columna"];
const PATRONES_DE_CORTE: Patron[] = ["diagonal", "diagonal_x"];

function tieneBanderaDeFallaCritica(b: Banderas): boolean {
  return b.acero_expuesto || b.concreto_triturado || b.desplazamiento_caras;
}

function sinNingunaBandera(b: Banderas): boolean {
  return (
    !b.acero_expuesto &&
    !b.concreto_triturado &&
    !b.desplazamiento_caras &&
    !b.elemento_inclinado &&
    !b.separacion_muro_estructura
  );
}

/** A.3 — confianza.elemento, confianza.patron, o confianza.ancho (solo si hay ancho_mm) por debajo del umbral. */
function confianzaPorDebajoDelUmbral(obs: ObservacionGrieta): boolean {
  const { elemento, patron, ancho } = obs.confianza;
  if (elemento < CONFIANZA_MINIMA || patron < CONFIANZA_MINIMA) return true;
  if (obs.ancho_mm !== null && ancho < CONFIANZA_MINIMA) return true;
  return false;
}

function construirVeredicto(nivel: Nivel, razon: string): Veredicto {
  return {
    nivel,
    razon,
    que_hacer: COPY_NIVEL[nivel],
    que_no_hacer: nivel === "verde" ? [] : QUE_NO_HACER_SI_NO_VERDE,
  };
}

/**
 * Evalúa UNA grieta observada. Devuelve el veredicto de la primera fila de la
 * tabla A.2 (spec) que aplique, en orden, sin excepciones.
 */
export function evaluarGrieta(obs: ObservacionGrieta): Veredicto {
  const { elemento, patron, ancho_mm, banderas } = obs;
  const esElementoEstructuralPrincipal = ELEMENTOS_CON_RIESGO_ESTRUCTURAL.includes(elemento);

  // Regla 1 — columna/viga/nudo con bandera de falla crítica → Rojo.
  if (esElementoEstructuralPrincipal && tieneBanderaDeFallaCritica(banderas)) {
    return construirVeredicto(
      "rojo",
      "grieta en columna, viga o nudo con acero expuesto, concreto triturado o desplazamiento de caras"
    );
  }

  // Regla 2 — columna/viga/nudo con patrón diagonal (posible falla de cortante), cualquier ancho → Rojo.
  if (esElementoEstructuralPrincipal && PATRONES_DE_CORTE.includes(patron)) {
    return construirVeredicto("rojo", "grieta diagonal en columna, viga o nudo (posible falla de cortante)");
  }

  // Regla 3 — elemento inclinado o separación muro/estructura, en CUALQUIER elemento → Rojo.
  // Es la única regla que no filtra por `elemento`.
  if (banderas.elemento_inclinado || banderas.separacion_muro_estructura) {
    return construirVeredicto("rojo", "elemento inclinado o separación entre el muro y la estructura");
  }

  // Regla 4 — muro de carga con grieta ancha (>3mm) o escalonada con indicio de ser pasante → Rojo.
  // "Indicio de pasante" = `desplazamiento_caras` (ver nota de cabecera).
  if (elemento === "muro_carga") {
    const grietaAncha = ancho_mm !== null && ancho_mm > 3;
    const escalonadaConIndicioPasante = patron === "escalonada" && banderas.desplazamiento_caras;
    if (grietaAncha || escalonadaConIndicioPasante) {
      return construirVeredicto(
        "rojo",
        "grieta en muro de carga con ancho mayor a 3 mm, o escalonada con indicio de ser pasante"
      );
    }
  }

  // Regla 5 — cualquier grieta en columna/viga/nudo/muro de carga que no cayó en rojo arriba → Amarillo.
  if (esElementoEstructuralPrincipal || elemento === "muro_carga") {
    return construirVeredicto("amarillo", "grieta en elemento estructural sin señales de falla crítica");
  }

  // Regla 6 — muro divisorio con grieta de ancho medible, patrón escalonado, o riesgo de
  // desprendimiento → Amarillo. "Riesgo de desprendimiento" = `desplazamiento_caras` (ver nota de cabecera).
  if (elemento === "muro_divisorio") {
    const anchoMedible = ancho_mm !== null;
    const riesgoDeDesprendimiento = banderas.desplazamiento_caras;
    if (anchoMedible || patron === "escalonada" || riesgoDeDesprendimiento) {
      return construirVeredicto(
        "amarillo",
        "grieta en muro divisorio con ancho medible, patrón escalonado, o riesgo de desprendimiento"
      );
    }
  }

  // Regla 7 — elemento no determinado, foto de mala calidad, o confianza por debajo del umbral (A.3) →
  // Amarillo. Al ir antes que la regla 8, es lo que impide que una observación dudosa resuelva en verde.
  if (elemento === "no_determinado" || obs.calidad_foto !== "ok" || confianzaPorDebajoDelUmbral(obs)) {
    return construirVeredicto(
      "amarillo",
      "elemento no determinado, foto de mala calidad, o confianza de la lectura por debajo del umbral"
    );
  }

  // Regla 8 — el ÚNICO camino a Verde: muro divisorio con craquelado superficial y sin ninguna bandera.
  if (elemento === "muro_divisorio" && patron === "craquelado" && sinNingunaBandera(banderas)) {
    return construirVeredicto("verde", "craquelado superficial en muro divisorio, sin banderas de alarma");
  }

  // Regla 9 — cualquier otro caso no cubierto arriba → Amarillo por defecto (conservador: nunca cae a
  // verde por omisión).
  return construirVeredicto("amarillo", "caso no cubierto explícitamente por las reglas — se documenta por defecto");
}

/** Rango de severidad para quedarnos con el PEOR nivel entre varios veredictos (nunca un promedio). */
const RANGO_NIVEL: Record<Nivel, number> = { verde: 0, amarillo: 1, rojo: 2 };

/**
 * El nivel de un inmueble es el PEOR de todas las grietas evaluadas en él,
 * nunca el promedio (spec A.2). Requiere al menos un veredicto: evaluar un
 * inmueble sin ninguna grieta observada es un error de quien llama, no un
 * caso de negocio válido.
 */
export function evaluarInmueble(veredictos: Veredicto[]): Veredicto {
  if (veredictos.length === 0) {
    throw new Error("evaluarInmueble requiere al menos un veredicto de grieta evaluado.");
  }
  return veredictos.reduce((peor, actual) => (RANGO_NIVEL[actual.nivel] > RANGO_NIVEL[peor.nivel] ? actual : peor));
}
