// ─────────────────────────────────────────────────────────────────────────
// FASES CURADAS de una obra B2C (spec Excel único + cronograma).
//
// La lista está en ORDEN CONSTRUCTIVO: es la secuencia que usa el motor de
// duración (estimar-duracion.ts) y el orden del dropdown de la plantilla
// Excel. La importación acepta variantes ("eléctricos", "obra gris", etc.)
// vía `normalizarFase`; lo que no se reconozca se devuelve al usuario para
// mapeo manual (y, en otra capa, a la IA — NUNCA aquí: este módulo es
// determinista y puro).
// ─────────────────────────────────────────────────────────────────────────

export const FASES_OBRA = [
  "Preliminares/Demolición",
  "Obra gris/Estructura",
  "Instalaciones eléctricas",
  "Instalaciones hidrosanitarias",
  "Repello/Estuco",
  "Pintura",
  "Pisos/Enchapes",
  "Carpintería/Madera",
  "Cocina/Closets",
  "Aparatos y grifería",
  "Detalles y aseo",
] as const;

export type FaseObra = (typeof FASES_OBRA)[number];

/** Orden constructivo de una fase (0..n). -1 si no es una fase curada. */
export function ordenFase(fase: string): number {
  return (FASES_OBRA as readonly string[]).indexOf(fase);
}

// Una sola normalización para TODO el matching del repo: minúsculas, sin
// tildes, sin puntuación y sin palabras vacías ("Enchape de pared" ≡ "enchape
// pared"). Se aplica a los dos lados de cada comparación.
import { normalizarParaMatch as limpiar } from "./normalizar-tarea";

// Variantes aceptadas por fase (además del nombre curado). El matching es por
// INCLUSIÓN de keyword en el texto del usuario, con la keyword más larga
// ganando (mismo criterio que buscarPrecioSemilla). El orden dentro de cada
// lista no importa.
const VARIANTES_FASE: Record<FaseObra, string[]> = {
  "Preliminares/Demolición": ["preliminar", "demolicion", "demoler", "desmonte", "retiro", "desmantelamiento"],
  "Obra gris/Estructura": ["obra gris", "gris", "estructura", "mamposteria", "muros", "cimentacion", "placa", "losa", "concreto"],
  "Instalaciones eléctricas": ["electrica", "electrico", "electricidad", "cableado", "red electrica"],
  "Instalaciones hidrosanitarias": ["hidrosanitaria", "hidraulica", "hidraulico", "sanitaria", "plomeria", "fontaneria", "tuberia", "red hidraulica", "instalaciones hidro"],
  "Repello/Estuco": ["repello", "estuco", "panete", "pañete", "revoque", "resane", "friso"],
  "Pintura": ["pintura", "pintar", "vinilo", "acabados de pintura"],
  "Pisos/Enchapes": ["piso", "pisos", "enchape", "ceramica", "porcelanato", "baldosa", "acabados de piso", "recubrimiento"],
  "Carpintería/Madera": ["carpinteria", "madera", "puertas", "ebanisteria", "lustro", "barniz"],
  "Cocina/Closets": ["cocina", "closet", "closets", "muebles", "mobiliario", "vestier"],
  "Aparatos y grifería": ["aparato", "aparatos", "griferia", "sanitarios", "lavamanos", "ducha", "accesorios de baño"],
  "Detalles y aseo": ["detalle", "detalles", "aseo", "limpieza", "remates", "entrega"],
};

/**
 * Normaliza una fase escrita por el usuario a la lista curada.
 * Tolerante: acepta el nombre exacto, mayúsculas/tildes distintas y variantes
 * comunes ("plomería" → "Instalaciones hidrosanitarias"). Devuelve `null` si
 * no se reconoce (el front la ofrece para mapeo manual).
 */
export function normalizarFase(texto: string): FaseObra | null {
  const t = limpiar(texto);
  if (!t) return null;

  // 1) Match exacto contra el nombre curado (normalizado).
  for (const fase of FASES_OBRA) {
    if (limpiar(fase) === t) return fase;
  }

  // 2) Variantes por inclusión. Se recorren TODAS las fases y se guarda el
  //    mejor puntaje de cada una, para poder detectar empates: si dos fases
  //    empatan, el término es ambiguo y adivinar sería peor que no responder.
  const puntajes = new Map<FaseObra, number>();
  for (const fase of FASES_OBRA) {
    let mejorDeEstaFase = 0;
    for (const v of VARIANTES_FASE[fase]) {
      const vv = limpiar(v);

      // (a) El texto del usuario CONTIENE la variante: señal fuerte. Cuanto más
      //     larga la variante, más específico el match («acabados de piso» pesa
      //     más que «piso»).
      if (t.includes(vv)) {
        if (vv.length > mejorDeEstaFase) mejorDeEstaFase = vv.length;
        continue;
      }

      // (b) La variante contiene al texto: solo vale para diferencias menores
      //     de sufijo o número («electrica» ⊂ «electricas», «piso» ⊂ «pisos»).
      //
      //     Antes esta rama aceptaba cualquier fragmento, y como puntuaba por
      //     el largo de la VARIANTE, un término genérico y corto ganaba con la
      //     variante más larga que lo contuviera. Efecto real: «ACABADOS»
      //     resolvía a «Pintura», porque «acabados de pintura» (19) le ganaba a
      //     «acabados de piso» (16) — mandando repello, estuco, pisos, enchapes
      //     y grifería a la fase equivocada en la importación de un presupuesto.
      //
      //     El umbral del 80% deja pasar plurales y sufijos, y corta los
      //     fragmentos genéricos.
      if (vv.includes(t) && t.length >= vv.length * 0.8) {
        if (t.length > mejorDeEstaFase) mejorDeEstaFase = t.length;
      }
    }
    if (mejorDeEstaFase > 0) puntajes.set(fase, mejorDeEstaFase);
  }

  if (puntajes.size === 0) return null;

  const maximo = Math.max(...puntajes.values());
  const ganadoras = [...puntajes.entries()].filter(([, p]) => p === maximo);

  // Empate = término de CAPÍTULO, no de fase («Acabados» agrupa repello,
  // pintura, pisos y grifería; «Instalaciones» puede ser eléctrica o
  // hidrosanitaria). Devolver `null` lo manda al mapeo manual, que es
  // justamente el camino que este módulo declara en su cabecera. En un
  // presupuesto adivinar mal no es un detalle: mueve dinero de capítulo.
  if (ganadoras.length > 1) return null;

  return ganadoras[0][0];
}

// ─────────────────────────────────────────────────────────────────────────
// Clasificación de TAREAS en fases (determinista).
// ─────────────────────────────────────────────────────────────────────────

import { buscarPrecioSemillaConLargo } from "./precios-semilla";

/**
 * Mapa clave de la base semilla (precios-semilla.ts) → fase curada.
 * Es la vía DETERMINISTA principal: si `buscarPrecioSemilla` reconoce la
 * tarea, su key define la fase sin ambigüedad.
 */
export const FASE_POR_KEY: Record<string, FaseObra> = {
  // Obra gris
  mamposteria: "Obra gris/Estructura",
  placa: "Obra gris/Estructura",
  pulida_piso: "Pisos/Enchapes",
  // Repello / estuco
  panete: "Repello/Estuco",
  estuco_pared: "Repello/Estuco",
  estuco_techo: "Repello/Estuco",
  resane: "Repello/Estuco",
  // Pintura
  sellador: "Pintura",
  pintura_base: "Pintura",
  pintura_final: "Pintura",
  // Pisos / enchapes
  enchape_piso: "Pisos/Enchapes",
  enchape_pared: "Pisos/Enchapes",
  porcelanato: "Pisos/Enchapes",
  // Instalaciones
  punto_electrico: "Instalaciones eléctricas",
  punto_hidraulico: "Instalaciones hidrosanitarias",
  punto_sanitario: "Instalaciones hidrosanitarias",
  aparato_sanitario: "Aparatos y grifería",
  // Carpintería / muebles
  puerta_instalacion: "Carpintería/Madera",
  lustro: "Carpintería/Madera",
  closet: "Cocina/Closets",
  mueble_bajo_cocina: "Cocina/Closets",
  mueble_alto_cocina: "Cocina/Closets",
  mueble_bano: "Cocina/Closets",
  // Claves que solo existen en rendimientos.ts (no tienen precio semilla).
  // `faseDeTarea` NO llega a ellas por esta vía —la vía es KEYWORDS_FASE, más
  // abajo— pero están aquí para que FASE_POR_KEY sea el mapa COMPLETO
  // clave → fase: es lo que consulta quien ya tiene la clave en la mano.
  demolicion: "Preliminares/Demolición",
  aseo: "Detalles y aseo",
  drywall: "Obra gris/Estructura",
  impermeabilizacion: "Obra gris/Estructura",
  meson: "Cocina/Closets",
  ventana: "Carpintería/Madera",
  mueble_generico: "Cocina/Closets",
};

// Heurística por keywords. COMPITE con el match de la semilla de precios (no
// va después de él): gana el término más largo de los dos.
//
// Qué entra aquí: la ACCIÓN («demoler», «estucar», «pintar»), no el ELEMENTO
// sobre el que se ejecuta («muros», «cielos», «pisos»). Un muro se demuele, se
// construye, se repella, se estuca y se pinta: la palabra «muro» sola no dice
// en qué fase estás. La tabla de precios empareja por elemento —está afinada
// para encontrar un precio comparable, no una fase—, así que las acciones de
// acabado se listan aquí para que puedan ganarle cuando son más específicas.
const KEYWORDS_FASE: [string, FaseObra][] = [
  ["demolicion", "Preliminares/Demolición"],
  ["demoler", "Preliminares/Demolición"],
  ["desmonte", "Preliminares/Demolición"],
  ["desmantelamiento", "Preliminares/Demolición"],
  ["retiro de escombro", "Preliminares/Demolición"],
  ["retiro", "Preliminares/Demolición"],
  // Acciones de acabado. Faltaban, y su ausencia dejaba «Estuco sobre muros» a
  // merced de la tabla de precios, que empareja «muros» con mampostería e
  // ignora el «estuco» — mandándolo a Estructura.
  ["repello", "Repello/Estuco"],
  ["estuco", "Repello/Estuco"],
  ["panete", "Repello/Estuco"],
  ["pañete", "Repello/Estuco"],
  ["revoque", "Repello/Estuco"],
  ["resane", "Repello/Estuco"],
  ["pintura", "Pintura"],
  ["pintar", "Pintura"],
  ["cielo raso", "Obra gris/Estructura"],
  ["drywall", "Obra gris/Estructura"],
  ["superboard", "Obra gris/Estructura"],
  ["impermeabiliza", "Obra gris/Estructura"],
  ["bombillo", "Instalaciones eléctricas"],
  ["lampara", "Instalaciones eléctricas"],
  ["breaker", "Instalaciones eléctricas"],
  ["tablero electrico", "Instalaciones eléctricas"],
  ["calentador", "Instalaciones hidrosanitarias"],
  ["tuberia", "Instalaciones hidrosanitarias"],
  ["laminado", "Pisos/Enchapes"],
  ["vinilico", "Pisos/Enchapes"],
  ["guardaescoba", "Pisos/Enchapes"],
  ["ventana", "Carpintería/Madera"],
  ["marco", "Carpintería/Madera"],
  ["meson", "Cocina/Closets"],
  ["mueble", "Cocina/Closets"],
  ["estufa", "Cocina/Closets"],
  ["campana", "Cocina/Closets"],
  ["espejo", "Detalles y aseo"],
  ["aseo", "Detalles y aseo"],
  ["limpieza", "Detalles y aseo"],
];

/**
 * Fase curada de una tarea por su nombre. DETERMINISTA:
 *  1) `buscarPrecioSemilla(nombre)` → key → FASE_POR_KEY.
 *  2) Heurística por keywords (KEYWORDS_FASE).
 *  3) `null` si nada matchea (la clasificación por IA de tareas no
 *     reconocidas vive en otra capa, NUNCA aquí).
 *
 * Entre (1) y (2) gana el término MÁS LARGO, igual que en `buscarRendimiento`:
 * si la fase y el rendimiento usaran criterios distintos, una misma tarea
 * podría estimarse como demolición y agendarse en la fase de estuco.
 */
export function faseDeTarea(nombre: string): FaseObra | null {
  // Dos de las veintiuna partidas de un presupuesto real caían en la fase
  // equivocada («Estuco sobre muros» y «Demolición de muros», ambas a Obra
  // gris por la palabra «muros»), y con ellas su cronograma y su corte. Por eso
  // las acciones compiten por largo contra la clave de precio.
  const n = limpiar(nombre);
  if (!n) return null;

  const p = buscarPrecioSemillaConLargo(nombre);
  const desdePrecio = p && FASE_POR_KEY[p.precio.key] ? FASE_POR_KEY[p.precio.key] : null;
  let mejor: FaseObra | null = desdePrecio;
  let mejorLargo = desdePrecio && p ? p.largo : 0;

  for (const [kw, fase] of KEYWORDS_FASE) {
    const k = limpiar(kw);
    if (k && n.includes(k) && k.length > mejorLargo) {
      mejor = fase;
      mejorLargo = k.length;
    }
  }
  return mejor;
}
