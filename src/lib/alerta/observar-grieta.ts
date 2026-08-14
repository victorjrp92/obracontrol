// ─────────────────────────────────────────────────────────────────────────
// Cliente de visión de Seiricon Alerta (SOLO servidor). REST directo a
// Anthropic, cero dependencias nuevas — mismo patrón que src/lib/deepseek.ts
// (fetch + AbortController + key solo en process.env + salida sanitizada
// como unión discriminada). NO se instala @anthropic-ai/sdk (spec D1: salida
// estructurada forzada con `tools`/`tool_choice`, superficie de
// supply-chain, coherencia con deepseek.ts).
//
//   - Endpoint:  POST https://api.anthropic.com/v1/messages
//   - Header:    anthropic-version: 2023-06-01
//   - Modelo:    Claude Haiku 4.5 (lanzado oct-2025) — el modelo con visión
//                más rápido/económico de la familia Claude vigente a la
//                fecha de este código (ene-2026). VERIFICA este ID contra
//                la documentación de Anthropic (docs.anthropic.com) antes de
//                depender de él en producción: si cambió o dejó de existir,
//                la llamada HTTP falla y el sistema degrada solo a modo
//                manual (nunca rompe el flujo — ver catches abajo).
//                Override: ALERTA_VISION_MODEL.
//   - Doble llave (kill-switch, NO se apaga por decisión de producto — ver
//     docs/specs/2026-08-13-seiricon-alerta-fase2.md): hace falta
//     ANTHROPIC_API_KEY presente Y ALERTA_VISION_ENABLED === "true". Si
//     falta cualquiera de las dos, degrada a `{ok:false, motivo:"sin_key"}`
//     sin lanzar — es el mecanismo normal para que /alerta/grietas funcione
//     igual en dev (sin key) que en producción (con key).
//
// REGLA NO NEGOCIABLE (spec D2): el prompt NUNCA recibe el elemento que la
// persona declaró en el Paso 1 (columna/muro/etc). Si se lo diéramos, el
// modelo se ancla a esa respuesta y la confirma — se destruye el propósito
// del contraste con lo que declaró el usuario. La reconciliación entre
// declarado/observado ocurre DESPUÉS, en TypeScript puro, en
// src/lib/alerta/triage.ts. Por eso `observarGrieta()` de abajo solo recibe
// las dos fotos, nunca el elemento declarado.
//
// R1 (refinamiento 2026-08-13) — DOBLE LECTURA (consenso):
// `observarGrietaConsenso()` dispara DOS llamadas independientes en paralelo
// y fusiona las dos observaciones de forma conservadora
// (`fusionarLecturas`). El motivo: la `confianza` que el modelo se
// autorreporta es justo lo que peor hace un LLM; la varianza entre dos
// muestras independientes sí es una señal medible. Por eso las dos llamadas
// del consenso usan `temperature: 0.5` y NO 0 — con temperatura 0 las dos
// respuestas serían (casi) la misma y una discrepancia dejaría de
// significar algo. La llamada individual `observarGrieta()` conserva su
// `temperature: 0` original porque no mide varianza.
// COSTO: el consenso DUPLICA el gasto de tokens por grieta. Interruptor
// `ALERTA_VISION_CONSENSO="false"` (string exacto) → una sola lectura. Por
// defecto está ACTIVADO.
// Ver docs/specs/2026-08-13-alerta-refinamiento-vision.md.
// ─────────────────────────────────────────────────────────────────────────
import type { Banderas, CalidadFoto, Elemento, ObservacionGrieta, Patron } from "./tipos";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ALERTA_VISION_MODEL || "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 25_000;
const MAX_TOKENS = 700;
/** Lectura única (comportamiento original de Fase 2): determinista. */
const TEMPERATURA_LECTURA_UNICA = 0;
/** Doble lectura: hace falta varianza de muestreo para que la discrepancia signifique algo (R1). */
const TEMPERATURA_CONSENSO = 0.5;

export type ObservarGrietaResult =
  | { ok: true; observacion: ObservacionGrieta; notaVisual: string | null }
  | { ok: false; motivo: "sin_key" | "error" };

const SYSTEM_PROMPT = `Eres un asistente que DESCRIBE lo que se ve en dos fotos de una grieta en una edificación, para un sistema de reglas fijas que decide el nivel de riesgo. Tu única tarea es reportar observaciones objetivas usando la herramienta "reportar_observacion" — nunca das un diagnóstico, un consejo de seguridad ni un veredicto.

Reglas estrictas:
- NO digas si es seguro, peligroso, si hay que evacuar, ni uses las palabras "rojo", "amarillo" o "verde".
- NO des recomendaciones ni consejos.
- "nota_visual" es SOLO una frase corta y neutral de lo que se ve (ej: "grieta diagonal de unos 2mm en la esquina superior de un muro"), sin juicios ni consejos.
- Si no puedes ver bien algo (foto oscura, movida, muy lejos, o sin la moneda de referencia visible), repórtalo en "calidad_foto" y baja la confianza correspondiente en vez de adivinar.
- El ancho NO se reporta como un número exacto: se reporta como un rango ("ancho_mm_min" y "ancho_mm_max") que contenga honestamente tu incertidumbre al medir con la moneda.
- La primera foto es un acercamiento con una moneda de $500 pesos colombianos (23.7mm de diámetro) pegada junto a la grieta, como referencia de escala — úsala para estimar "ancho_mm". La segunda foto muestra el elemento completo (de piso a techo) para identificar qué tipo de elemento es.
- Responde EXCLUSIVAMENTE llamando la herramienta "reportar_observacion" con el JSON exacto que pide su esquema.`;

const OBSERVACION_TOOL = {
  name: "reportar_observacion",
  description: "Reporta la observación estructurada de la grieta a partir de las dos fotos, sin diagnóstico ni consejo.",
  input_schema: {
    type: "object",
    properties: {
      elemento: {
        type: "string",
        enum: ["columna", "viga", "nudo_viga_columna", "muro_carga", "muro_divisorio", "losa_techo", "piso", "fachada", "no_determinado"],
        description: "Tipo de elemento estructural que se ve en la Foto 2 (elemento completo).",
      },
      patron: {
        type: "string",
        enum: ["diagonal", "diagonal_x", "vertical", "horizontal", "escalonada", "craquelado", "esquina_vano", "junta_entre_elementos"],
        description: "Patrón geométrico de la grieta.",
      },
      ancho_mm_min: {
        type: ["number", "null"],
        description:
          "Extremo INFERIOR del rango de incertidumbre del ancho de la grieta, en milímetros, midiendo con la moneda de la Foto 1 como escala (23.7mm de diámetro). Ejemplo: si la grieta se ve 'entre 2 y 4 mm', acá va 2. null si no se puede estimar.",
      },
      ancho_mm_max: {
        type: ["number", "null"],
        description:
          "Extremo SUPERIOR del mismo rango de incertidumbre, en milímetros. Ejemplo: si la grieta se ve 'entre 2 y 4 mm', acá va 4. Debe ser mayor o igual a ancho_mm_min. null si no se puede estimar.",
      },
      banderas: {
        type: "object",
        properties: {
          acero_expuesto: { type: "boolean" },
          concreto_triturado: { type: "boolean" },
          desplazamiento_caras: { type: "boolean", description: "Un lado de la grieta quedó más alto/adelante que el otro." },
          elemento_inclinado: { type: "boolean" },
          separacion_muro_estructura: { type: "boolean" },
        },
        required: ["acero_expuesto", "concreto_triturado", "desplazamiento_caras", "elemento_inclinado", "separacion_muro_estructura"],
      },
      confianza: {
        type: "object",
        properties: {
          elemento: { type: "number", description: "0 a 1." },
          patron: { type: "number", description: "0 a 1." },
          ancho: { type: "number", description: "0 a 1. Solo relevante si el rango de ancho no es null." },
        },
        required: ["elemento", "patron", "ancho"],
      },
      calidad_foto: {
        type: "string",
        enum: ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"],
      },
      nota_visual: {
        type: "string",
        description: "Una frase corta y neutral de lo que se ve. Sin juicios de seguridad ni consejos. Máximo ~140 caracteres.",
      },
    },
    required: ["elemento", "patron", "ancho_mm_min", "ancho_mm_max", "banderas", "confianza", "calidad_foto", "nota_visual"],
  },
};

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return null;
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return { mediaType, base64: match[2] };
}

const ELEMENTOS: Elemento[] = [
  "columna",
  "viga",
  "nudo_viga_columna",
  "muro_carga",
  "muro_divisorio",
  "losa_techo",
  "piso",
  "fachada",
  "no_determinado",
];
const PATRONES: Patron[] = [
  "diagonal",
  "diagonal_x",
  "vertical",
  "horizontal",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];
const CALIDADES: CalidadFoto[] = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];

function clamp01(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Número >= 0, o null (cualquier basura — negativo, NaN, string, undefined — cae a null). */
function anchoValido(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Valida y sanitiza la salida cruda de la tool call del modelo (o de
 * cualquier `unknown`, para poder probarla en `scripts/verificar-triage-alerta.ts`
 * sin llamar a la red). Ver spec Fase 2, sección 6, punto 7:
 *
 *   - confianza fuera de [0,1] → se clampa.
 *   - ancho negativo (o no numérico) → null.
 *   - calidad_foto === "sin_referencia_escala" → confianza.ancho = 0, PERO
 *     el ancho_mm reportado se CONSERVA (no se nulifica: nulificarlo
 *     apagaría la vía de la regla 4 de reglas.ts — muro_carga con
 *     ancho > 3mm — y ablandaría un rojo a amarillo).
 *   - cualquier enum desconocido (elemento/patron/calidad_foto) → se
 *     RECHAZA la observación completa (devuelve null); el caller cae a modo
 *     manual con motivo "error".
 *
 * R2 — el schema pide `ancho_mm_min`/`ancho_mm_max` (rango de incertidumbre)
 * en vez de un `ancho_mm` con falsa precisión:
 *
 *   - `ancho_mm` = el EXTREMO CONSERVADOR del rango, o sea `max`. Usar el
 *     mínimo ablandaría la regla 4 (muro de carga con ancho > 3mm → rojo).
 *   - `min > max` → se corrige intercambiándolos, NO se rechaza la
 *     observación (un modelo que confunde el orden de dos campos igual
 *     midió algo; descartarlo apagaría una vía a rojo).
 *   - si solo uno de los dos extremos vino, ese es el ancho.
 *   - `ancho_rango` se conserva aparte, para poder decir "entre 2 y 4 mm".
 *   - compatibilidad: si no viene ningún extremo pero sí un `ancho_mm`
 *     plano (schema viejo de Fase 2, o un modelo que ignora el schema
 *     nuevo), se usa como rango degenerado min = max = ancho_mm.
 */
export function normalizarObservacion(raw: unknown): ObservacionGrieta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.elemento !== "string" || !ELEMENTOS.includes(r.elemento as Elemento)) return null;
  if (typeof r.patron !== "string" || !PATRONES.includes(r.patron as Patron)) return null;
  if (typeof r.calidad_foto !== "string" || !CALIDADES.includes(r.calidad_foto as CalidadFoto)) return null;
  const calidad_foto = r.calidad_foto as CalidadFoto;

  const bRaw = r.banderas && typeof r.banderas === "object" ? (r.banderas as Record<string, unknown>) : null;
  if (!bRaw) return null;
  const banderas: Banderas = {
    acero_expuesto: bRaw.acero_expuesto === true,
    concreto_triturado: bRaw.concreto_triturado === true,
    desplazamiento_caras: bRaw.desplazamiento_caras === true,
    elemento_inclinado: bRaw.elemento_inclinado === true,
    separacion_muro_estructura: bRaw.separacion_muro_estructura === true,
  };

  const cRaw = r.confianza && typeof r.confianza === "object" ? (r.confianza as Record<string, unknown>) : null;
  const confianza = {
    elemento: clamp01(cRaw?.elemento),
    patron: clamp01(cRaw?.patron),
    ancho: clamp01(cRaw?.ancho),
  };

  let min = anchoValido(r.ancho_mm_min);
  let max = anchoValido(r.ancho_mm_max);
  if (min === null && max === null) {
    const plano = anchoValido(r.ancho_mm); // compatibilidad con el schema plano (ver docstring)
    min = plano;
    max = plano;
  }
  if (min !== null && max !== null && min > max) {
    [min, max] = [max, min];
  }
  // Extremo conservador: el máximo. Si solo hay un extremo, ese es el ancho.
  const ancho_mm = max ?? min;

  // Sin referencia de escala visible: la confianza del ancho baja a 0, pero
  // el ancho_mm se conserva tal cual lo reportó el modelo (ver docstring).
  if (calidad_foto === "sin_referencia_escala") {
    confianza.ancho = 0;
  }

  const observacion: ObservacionGrieta = {
    elemento: r.elemento as Elemento,
    patron: r.patron as Patron,
    ancho_mm,
    banderas,
    confianza,
    calidad_foto,
  };
  // Campo opcional: solo se adjunta si el modelo estimó algo.
  if (min !== null || max !== null) observacion.ancho_rango = { min, max };
  return observacion;
}

/**
 * Orden explícito de calidad de foto, de la MEJOR (0) a la peor. Solo "ok"
 * es aceptable para `reglas.ts` (regla 7 mira `calidad_foto !== "ok"`); el
 * orden entre las malas existe únicamente para que la fusión de dos lecturas
 * (R1) y los reportes de calibración sean deterministas.
 */
const ORDEN_CALIDAD_FOTO: Record<CalidadFoto, number> = {
  ok: 0,
  sin_referencia_escala: 1,
  muy_lejos: 2,
  oscura: 3,
  movida: 4,
};

/** Máximo tolerante a null: si uno es null, gana el otro. */
function maximoNoNulo(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** Mínimo tolerante a null: si uno es null, gana el otro. */
function minimoNoNulo(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

/** Rango declarado de una observación; si no lo trae, se deriva de `ancho_mm`. */
function rangoDe(obs: ObservacionGrieta): { min: number | null; max: number | null } {
  return obs.ancho_rango ?? { min: obs.ancho_mm, max: obs.ancho_mm };
}

/**
 * R1 — fusión CONSERVADORA de dos lecturas independientes de las mismas dos
 * fotos. Función pura (nada de red): es la única pieza con lógica del
 * consenso, y por eso se verifica con pares de observaciones inventadas en
 * `scripts/verificar-triage-alerta.ts`.
 *
 *   - `elemento` / `patron`: se CONSERVA el de la primera lectura (`a`) — no
 *     se inventa un tercer valor —, pero si las dos lecturas no coinciden la
 *     confianza correspondiente baja a 0. En `reglas.ts` eso solo puede
 *     activar la regla 7 (amarillo), que corre después de las reglas 1-6:
 *     nunca ablanda un rojo, y tapa el camino a verde. Si coinciden, se toma
 *     la MENOR de las dos confianzas (también conservador).
 *   - `banderas`: unión lógica (OR) campo por campo. Si cualquiera de las
 *     dos vio acero expuesto, cuenta como visto.
 *   - `ancho_mm`: el MÁXIMO de ambos (null-tolerante) — el extremo que puede
 *     disparar la regla 4, nunca el que la apaga. `ancho_rango` queda como
 *     la unión de los dos rangos.
 *   - `calidad_foto`: la PEOR de las dos (ver `ORDEN_CALIDAD_FOTO`).
 *   - `confianza.ancho`: el MÍNIMO de ambas.
 */
export function fusionarLecturas(a: ObservacionGrieta, b: ObservacionGrieta): ObservacionGrieta {
  const mismoElemento = a.elemento === b.elemento;
  const mismoPatron = a.patron === b.patron;

  const rangoA = rangoDe(a);
  const rangoB = rangoDe(b);
  const min = minimoNoNulo(rangoA.min, rangoB.min);
  const max = maximoNoNulo(rangoA.max, rangoB.max);

  const fusionada: ObservacionGrieta = {
    elemento: a.elemento,
    patron: a.patron,
    ancho_mm: maximoNoNulo(a.ancho_mm, b.ancho_mm),
    banderas: {
      acero_expuesto: a.banderas.acero_expuesto || b.banderas.acero_expuesto,
      concreto_triturado: a.banderas.concreto_triturado || b.banderas.concreto_triturado,
      desplazamiento_caras: a.banderas.desplazamiento_caras || b.banderas.desplazamiento_caras,
      elemento_inclinado: a.banderas.elemento_inclinado || b.banderas.elemento_inclinado,
      separacion_muro_estructura: a.banderas.separacion_muro_estructura || b.banderas.separacion_muro_estructura,
    },
    confianza: {
      elemento: mismoElemento ? Math.min(a.confianza.elemento, b.confianza.elemento) : 0,
      patron: mismoPatron ? Math.min(a.confianza.patron, b.confianza.patron) : 0,
      ancho: Math.min(a.confianza.ancho, b.confianza.ancho),
    },
    calidad_foto: ORDEN_CALIDAD_FOTO[b.calidad_foto] > ORDEN_CALIDAD_FOTO[a.calidad_foto] ? b.calidad_foto : a.calidad_foto,
  };
  if (min !== null || max !== null) fusionada.ancho_rango = { min, max };
  return fusionada;
}

/**
 * R1 — una sola lectura NO da consenso: si una de las dos llamadas falla,
 * se usa la que respondió pero con TODAS las confianzas en 0 (regla 7 de
 * `reglas.ts` → amarillo; nunca ablanda un rojo, nunca deja pasar un verde).
 */
export function sinConsenso(obs: ObservacionGrieta): ObservacionGrieta {
  return { ...obs, confianza: { elemento: 0, patron: 0, ancho: 0 } };
}

const PALABRAS_PROHIBIDAS = /segur|peligr|\brojo\b|\bamarillo\b|\bverde\b|evacu|colaps|tranquil|no pasa nada|recomiend/i;

/**
 * Filtro de lenguaje de la nota descriptiva del modelo (spec D8): un modelo
 * no le dice a alguien en emergencia si su casa es segura. Corta a 140
 * caracteres y descarta la nota COMPLETA si matchea la lista negra — nunca
 * la reescribe ni la "limpia" parcialmente.
 */
export function sanitizarNotaVisual(nota: unknown): string | null {
  if (typeof nota !== "string") return null;
  const limpia = nota.trim();
  if (!limpia) return null;
  if (PALABRAS_PROHIBIDAS.test(limpia)) return null;
  return limpia.slice(0, 140);
}

export interface FotosGrieta {
  fotoCercaDataUrl: string;
  fotoLejosDataUrl: string;
}

/** Doble llave del kill-switch (spec Fase 2, D1): key presente Y ALERTA_VISION_ENABLED === "true". */
function leerKeyHabilitada(): string | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.ALERTA_VISION_ENABLED !== "true") return null;
  return key;
}

/**
 * UNA llamada al modelo de visión con las dos fotos. `temperature` es
 * parámetro porque la lectura individual es determinista (0) y las del
 * consenso necesitan varianza de muestreo (0.5, ver R1 en la cabecera).
 * Nunca lanza.
 */
async function llamarModeloVision(args: FotosGrieta, key: string, temperature: number): Promise<ObservarGrietaResult> {
  const cerca = parseDataUrl(args.fotoCercaDataUrl);
  const lejos = parseDataUrl(args.fotoLejosDataUrl);
  if (!cerca || !lejos) return { ok: false, motivo: "error" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature,
        system: SYSTEM_PROMPT,
        tools: [OBSERVACION_TOOL],
        tool_choice: { type: "tool", name: OBSERVACION_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Foto 1 — acercamiento con moneda de referencia:" },
              { type: "image", source: { type: "base64", media_type: cerca.mediaType, data: cerca.base64 } },
              { type: "text", text: "Foto 2 — elemento completo, de piso a techo:" },
              { type: "image", source: { type: "base64", media_type: lejos.mediaType, data: lejos.base64 } },
            ],
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, motivo: "error" };

    const data = await res.json();
    const content: unknown[] = Array.isArray(data?.content) ? data.content : [];
    const toolUse = content.find(
      (bloque): bloque is { type: "tool_use"; input: unknown } =>
        !!bloque && typeof bloque === "object" && (bloque as Record<string, unknown>).type === "tool_use"
    );
    if (!toolUse) return { ok: false, motivo: "error" };

    const observacion = normalizarObservacion(toolUse.input);
    if (!observacion) return { ok: false, motivo: "error" };

    const notaCruda = (toolUse.input as Record<string, unknown> | null)?.nota_visual;
    const notaVisual = sanitizarNotaVisual(notaCruda);

    return { ok: true, observacion, notaVisual };
  } catch {
    return { ok: false, motivo: "error" }; // timeout, red, JSON inválido → el caller cae a modo manual
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Llama al modelo de visión con las dos fotos de una grieta, UNA sola vez.
 * NUNCA recibe el elemento declarado por el usuario (D2). Nunca lanza:
 * cualquier fallo (sin key, apagado, timeout, red, JSON inválido, enum
 * desconocido) resuelve en `{ ok: false, motivo }` — el caller
 * (`observarGrietaConsenso` / la API route) decide el fallback a modo manual.
 *
 * Conserva `temperature: 0` (comportamiento original de Fase 2). El camino
 * de producción hoy es `observarGrietaConsenso()`.
 */
export async function observarGrieta(args: FotosGrieta): Promise<ObservarGrietaResult> {
  const key = leerKeyHabilitada();
  if (!key) return { ok: false, motivo: "sin_key" };
  return llamarModeloVision(args, key, TEMPERATURA_LECTURA_UNICA);
}

/** `ALERTA_VISION_CONSENSO="false"` (string exacto) apaga la doble lectura. Por defecto está activada. */
export function consensoActivado(): boolean {
  return process.env.ALERTA_VISION_CONSENSO !== "false";
}

/**
 * R1 — DOBLE LECTURA. Dispara dos llamadas independientes en paralelo
 * (`Promise.all`, `temperature: 0.5`) y fusiona las dos observaciones con
 * `fusionarLecturas()`. Duplica el costo en tokens por grieta: es el precio
 * de medir la varianza real del modelo en vez de creerle la confianza que
 * él mismo se autorreporta.
 *
 *   - las dos responden → observación fusionada (conservadora campo a campo).
 *   - una sola responde → esa lectura con TODAS las confianzas en 0
 *     (`sinConsenso`): una lectura no es consenso.
 *   - ninguna responde → `{ok:false, motivo}` igual que hoy (el caller cae a
 *     modo manual).
 *   - `ALERTA_VISION_CONSENSO === "false"` → una sola lectura, comportamiento
 *     idéntico a `observarGrieta()`.
 *
 * La `notaVisual` NO se fusiona (es texto descriptivo, no entra a ninguna
 * regla): se conserva la de la primera lectura y, si vino vacía o la
 * descartó el filtro de lenguaje, la de la segunda.
 */
export async function observarGrietaConsenso(args: FotosGrieta): Promise<ObservarGrietaResult> {
  const key = leerKeyHabilitada();
  if (!key) return { ok: false, motivo: "sin_key" };
  if (!consensoActivado()) return llamarModeloVision(args, key, TEMPERATURA_LECTURA_UNICA);

  const [primera, segunda] = await Promise.all([
    llamarModeloVision(args, key, TEMPERATURA_CONSENSO),
    llamarModeloVision(args, key, TEMPERATURA_CONSENSO),
  ]);

  if (primera.ok && segunda.ok) {
    return {
      ok: true,
      observacion: fusionarLecturas(primera.observacion, segunda.observacion),
      notaVisual: primera.notaVisual ?? segunda.notaVisual,
    };
  }
  if (primera.ok) return { ok: true, observacion: sinConsenso(primera.observacion), notaVisual: primera.notaVisual };
  if (segunda.ok) return { ok: true, observacion: sinConsenso(segunda.observacion), notaVisual: segunda.notaVisual };
  return primera; // las dos fallaron → se reporta el motivo de la primera
}
