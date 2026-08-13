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
// ─────────────────────────────────────────────────────────────────────────
import type { Banderas, CalidadFoto, Elemento, ObservacionGrieta, Patron } from "./tipos";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ALERTA_VISION_MODEL || "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 25_000;
const MAX_TOKENS = 700;

export type ObservarGrietaResult =
  | { ok: true; observacion: ObservacionGrieta; notaVisual: string | null }
  | { ok: false; motivo: "sin_key" | "error" };

const SYSTEM_PROMPT = `Eres un asistente que DESCRIBE lo que se ve en dos fotos de una grieta en una edificación, para un sistema de reglas fijas que decide el nivel de riesgo. Tu única tarea es reportar observaciones objetivas usando la herramienta "reportar_observacion" — nunca das un diagnóstico, un consejo de seguridad ni un veredicto.

Reglas estrictas:
- NO digas si es seguro, peligroso, si hay que evacuar, ni uses las palabras "rojo", "amarillo" o "verde".
- NO des recomendaciones ni consejos.
- "nota_visual" es SOLO una frase corta y neutral de lo que se ve (ej: "grieta diagonal de unos 2mm en la esquina superior de un muro"), sin juicios ni consejos.
- Si no puedes ver bien algo (foto oscura, movida, muy lejos, o sin la moneda de referencia visible), repórtalo en "calidad_foto" y baja la confianza correspondiente en vez de adivinar.
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
      ancho_mm: {
        type: ["number", "null"],
        description: "Ancho estimado de la grieta en milímetros, usando la moneda de la Foto 1 como escala. null si no se puede estimar.",
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
          ancho: { type: "number", description: "0 a 1. Solo relevante si ancho_mm no es null." },
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
    required: ["elemento", "patron", "ancho_mm", "banderas", "confianza", "calidad_foto", "nota_visual"],
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

/**
 * Valida y sanitiza la salida cruda de la tool call del modelo (o de
 * cualquier `unknown`, para poder probarla en `scripts/verificar-triage-alerta.ts`
 * sin llamar a la red). Ver spec Fase 2, sección 6, punto 7:
 *
 *   - confianza fuera de [0,1] → se clampa.
 *   - ancho_mm negativo → null.
 *   - calidad_foto === "sin_referencia_escala" → confianza.ancho = 0, PERO
 *     el ancho_mm reportado se CONSERVA (no se nulifica: nulificarlo
 *     apagaría la vía de la regla 4 de reglas.ts — muro_carga con
 *     ancho > 3mm — y ablandaría un rojo a amarillo).
 *   - cualquier enum desconocido (elemento/patron/calidad_foto) → se
 *     RECHAZA la observación completa (devuelve null); el caller cae a modo
 *     manual con motivo "error".
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

  let ancho_mm: number | null = null;
  if (r.ancho_mm !== null && r.ancho_mm !== undefined) {
    const anchoNum = Number(r.ancho_mm);
    if (Number.isFinite(anchoNum) && anchoNum >= 0) ancho_mm = anchoNum;
  }

  // Sin referencia de escala visible: la confianza del ancho baja a 0, pero
  // el ancho_mm se conserva tal cual lo reportó el modelo (ver docstring).
  if (calidad_foto === "sin_referencia_escala") {
    confianza.ancho = 0;
  }

  return { elemento: r.elemento as Elemento, patron: r.patron as Patron, ancho_mm, banderas, confianza, calidad_foto };
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

/**
 * Llama al modelo de visión con las dos fotos de una grieta. NUNCA recibe el
 * elemento declarado por el usuario (D2). Nunca lanza: cualquier fallo
 * (sin key, apagado, timeout, red, JSON inválido, enum desconocido) resuelve
 * en `{ ok: false, motivo }` — el caller (GrietaWizard.tsx / la API route)
 * decide el fallback a modo manual.
 */
export async function observarGrieta(args: {
  fotoCercaDataUrl: string;
  fotoLejosDataUrl: string;
}): Promise<ObservarGrietaResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.ALERTA_VISION_ENABLED !== "true") {
    return { ok: false, motivo: "sin_key" };
  }

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
        temperature: 0,
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
