// ─────────────────────────────────────────────────────────────────────────
// Cliente DeepSeek (SOLO servidor). API OpenAI-compatible.
//   - Base URL:  https://api.deepseek.com
//   - Endpoint:  /chat/completions
//   - Modelos:   deepseek-v4-pro (default) | deepseek-v4-flash (más barato)
//   - thinking:  DESACTIVADO ({ type: "disabled" }) → respuesta rápida y
//                determinista. Los modelos V4 vienen en modo "thinking" por
//                defecto, que es lento y puede pasarse del timeout.
//   - JSON mode: response_format { type: "json_object" } (+ se instruye JSON
//                en el prompt, requisito de DeepSeek).
//
// La key vive SOLO en process.env.DEEPSEEK_API_KEY (nunca en cliente ni repo).
// NOTA: módulo server-only por convención — solo lo importa la API route
// /api/sugerencias/tareas. Nunca lo importes desde un componente cliente.
// ─────────────────────────────────────────────────────────────────────────

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const TIMEOUT_MS = 15_000;

export interface TareaIA {
  nombre: string;
  dias: number;
}

export type SugerenciasResult =
  | { ok: true; data: Record<string, TareaIA[]> }
  | { ok: false; motivo: "sin_key" | "error" };

interface ChatOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/** Llama a DeepSeek en modo JSON, thinking desactivado. Objeto parseado o null. */
async function chatJSON<T>(opts: ChatOpts): Promise<T | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 2000,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null; // timeout, red, JSON inválido → fallback
  } finally {
    clearTimeout(timer);
  }
}

const LABEL_OBRA: Record<string, string> = {
  REFORMA: "reforma / remodelación",
  MODIFICACION: "modificación / ampliación",
  OBRA_NUEVA: "obra nueva (de cero)",
};
const LABEL_PROP: Record<string, string> = {
  CASA: "casa", APARTAMENTO: "apartamento", EDIFICIO: "edificio", LOCAL: "local comercial",
};

function sanitizarTareas(tareas: unknown): TareaIA[] {
  if (!Array.isArray(tareas)) return [];
  return tareas
    .filter((t): t is { nombre: unknown; dias: unknown } => !!t && typeof t === "object")
    .filter((t) => typeof t.nombre === "string" && (t.nombre as string).trim())
    .map((t) => ({
      nombre: (t.nombre as string).trim().slice(0, 120),
      dias: Math.max(1, Math.min(60, Math.round(Number(t.dias) || 1))),
    }))
    .slice(0, 12);
}

/**
 * Sugiere, en UNA sola llamada, las tareas relevantes para cada espacio/elemento
 * de una obra. Correlación por ÍNDICE (no por nombre) para evitar fallos de
 * matching: enviamos los espacios numerados y el modelo devuelve el mismo índice.
 *
 * Devuelve { ok:true, data } o { ok:false, motivo } — el caller decide el
 * fallback (plantillas estáticas) y puede mostrar por qué no hubo IA.
 */
export async function sugerirTareasIA(args: {
  espacios: string[];
  tipoObra: string;
  tipoPropiedad: string;
  ciudad?: string | null;
}): Promise<SugerenciasResult> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, motivo: "sin_key" };

  const espacios = Array.from(
    new Set(args.espacios.map((e) => e.trim()).filter(Boolean)),
  ).slice(0, 40);
  if (espacios.length === 0) return { ok: false, motivo: "error" };

  const obra = LABEL_OBRA[args.tipoObra] || "obra de construcción";
  const prop = LABEL_PROP[args.tipoPropiedad] || "propiedad";
  const ciudad = args.ciudad ? ` en ${args.ciudad}, Colombia` : " en Colombia";
  const indexados = espacios.map((nombre, i) => ({ i, espacio: nombre }));

  const system =
    "Eres un maestro de obra colombiano con 20 años de experiencia en remodelaciones y construcción. " +
    "Conoces las tareas reales y su orden de ejecución para cada espacio o elemento de una obra. " +
    "Respondes siempre en español neutro y formal, y SOLO en JSON válido.";

  const user =
    `Obra: ${obra} de un ${prop}${ciudad}.\n` +
    `Para CADA espacio/elemento de la lista, indica ÚNICAMENTE las tareas de construcción que ` +
    `realmente apliquen a ese espacio, en orden lógico de ejecución, con los días hábiles que suele ` +
    `tomar cada tarea (entero >=1). NO incluyas tareas que no correspondan: por ejemplo, en "pisos" ` +
    `no pongas tareas de pared/estuco/pintura de muros; en "techo" pon cielo raso/pintura de techo, no piso; ` +
    `en "paredes" pon resane/estuco/pintura, no acabado de piso. Entre 3 y 8 tareas por espacio, nombres cortos.\n\n` +
    `Espacios (con índice): ${JSON.stringify(indexados)}\n\n` +
    `Responde SOLO con JSON de esta forma exacta, usando EL MISMO índice "i" que te di:\n` +
    `{"espacios":[{"i":0,"tareas":[{"nombre":"<tarea>","dias":<entero>}]}]}`;

  const parsed = await chatJSON<{ espacios?: { i?: number; tareas?: unknown }[] }>({ system, user });
  if (!parsed?.espacios || !Array.isArray(parsed.espacios)) return { ok: false, motivo: "error" };

  const out: Record<string, TareaIA[]> = {};
  for (const item of parsed.espacios) {
    const idx = Number(item?.i);
    const nombre = espacios[idx];
    if (nombre == null) continue;
    const tareas = sanitizarTareas(item?.tareas);
    if (tareas.length) out[nombre] = tareas;
  }
  return Object.keys(out).length ? { ok: true, data: out } : { ok: false, motivo: "error" };
}
