// ─────────────────────────────────────────────────────────────────────────
// Cliente DeepSeek (SOLO servidor). API OpenAI-compatible.
//   - Base URL:  https://api.deepseek.com
//   - Endpoint:  /chat/completions
//   - Modelos:   deepseek-v4-flash (barato/rápido, default) | deepseek-v4-pro
//   - JSON mode: response_format { type: "json_object" }
//
// La key vive SOLO en process.env.DEEPSEEK_API_KEY (nunca en cliente ni repo).
// Si no hay key, o falla/expira, las funciones devuelven null → el caller cae
// al fallback determinista (plantillas estáticas / base semilla).
//
// NOTA: este módulo es server-only por convención — solo lo importa la API route
// /api/sugerencias/tareas. Nunca lo importes desde un componente cliente.
// ─────────────────────────────────────────────────────────────────────────

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const TIMEOUT_MS = 12_000;

export interface TareaIA {
  nombre: string;
  dias: number;
}

interface ChatOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/** Llama a DeepSeek en modo JSON. Devuelve el objeto parseado o null si falla. */
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
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: { type: "json_object" },
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1800,
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

export interface SugerenciaEspacio {
  nombre: string;
  tareas: TareaIA[];
}

/**
 * Sugiere, en UNA sola llamada, las tareas relevantes para cada espacio/elemento
 * de una obra. Devuelve un mapa { nombreEspacio -> TareaIA[] } o null si falla
 * (el caller usa entonces las plantillas estáticas).
 *
 * Clave: el modelo SOLO debe sugerir tareas que apliquen a ese espacio (no poner
 * tareas de pared en un piso, etc.).
 */
export async function sugerirTareasIA(args: {
  espacios: string[];
  tipoObra: string;
  tipoPropiedad: string;
  ciudad?: string | null;
}): Promise<Record<string, TareaIA[]> | null> {
  const espacios = args.espacios.map((e) => e.trim()).filter(Boolean).slice(0, 40);
  if (espacios.length === 0) return null;

  const obra = LABEL_OBRA[args.tipoObra] || "obra de construcción";
  const prop = LABEL_PROP[args.tipoPropiedad] || "propiedad";
  const ciudad = args.ciudad ? ` en ${args.ciudad}, Colombia` : " en Colombia";

  const system =
    "Eres un maestro de obra colombiano con 20 años de experiencia en remodelaciones y construcción. " +
    "Conoces las tareas reales y su orden de ejecución para cada espacio o elemento de una obra. " +
    "Respondes siempre en español neutro y formal, en JSON válido.";

  const user =
    `Obra: ${obra} de un ${prop}${ciudad}.\n` +
    `Para CADA uno de estos espacios o elementos, lista ÚNICAMENTE las tareas de construcción que ` +
    `realmente apliquen a ese espacio, en orden lógico de ejecución, con los días hábiles que suele ` +
    `tomar cada tarea (entero, >=1). NO incluyas tareas que no correspondan al espacio ` +
    `(por ejemplo, no pongas tareas de pared o estuco en un "piso", ni acabados de piso en "paredes"). ` +
    `Entre 3 y 8 tareas por espacio. Usa nombres de tarea cortos y claros.\n\n` +
    `Espacios: ${JSON.stringify(espacios)}\n\n` +
    `Responde SOLO con JSON de esta forma exacta (usa el nombre del espacio TAL CUAL te lo di):\n` +
    `{"espacios":[{"nombre":"<nombre del espacio>","tareas":[{"nombre":"<tarea>","dias":<entero>}]}]}`;

  const parsed = await chatJSON<{ espacios?: SugerenciaEspacio[] }>({ system, user });
  if (!parsed?.espacios || !Array.isArray(parsed.espacios)) return null;

  const out: Record<string, TareaIA[]> = {};
  for (const esp of parsed.espacios) {
    if (!esp?.nombre || !Array.isArray(esp.tareas)) continue;
    const tareas = esp.tareas
      .filter((t) => t && typeof t.nombre === "string" && t.nombre.trim())
      .map((t) => ({
        nombre: t.nombre.trim().slice(0, 120),
        dias: Math.max(1, Math.min(60, Math.round(Number(t.dias) || 1))),
      }))
      .slice(0, 12);
    if (tareas.length) out[esp.nombre.trim()] = tareas;
  }
  return Object.keys(out).length ? out : null;
}
