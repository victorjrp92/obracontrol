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

import { PRECIOS_SEMILLA } from "./precios-semilla";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const TIMEOUT_MS = 15_000;
const INT_CAP = 2_000_000_000;

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

/**
 * Etiqueta legible del tipo de obra para el prompt.
 *
 * `MODIFICACION` se fusionó dentro de `REFORMA` (ver `plantillas-personal.ts`:
 * `TIPOS_OBRA` ya solo tiene dos claves), pero NO se borra la entrada: los
 * proyectos creados antes de la fusión siguen con `tipo_obra = "MODIFICACION"`
 * en la base y al reabrirlos el valor crudo llega hasta aquí. Sin esta línea
 * caerían en el `||` de abajo y el modelo recibiría «obra de construcción»
 * —peor prompt— en vez del texto correcto. Apunta al MISMO texto que REFORMA,
 * que es lo que dice hoy la fusión.
 */
const LABEL_OBRA: Record<string, string> = {
  REFORMA: "reforma / remodelación",
  MODIFICACION: "reforma / remodelación",
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
  /** Estado de la obra: NUEVA | MEDIAS | AVANZADA. Filtra tareas por etapa. */
  puntoPartida?: string | null;
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

  // Instrucción de etapa: solo tareas coherentes con cómo va la obra.
  const ETAPA: Record<string, string> = {
    NUEVA:
      "La obra APENAS INICIA (no se ha hecho nada). Empieza por lo grueso: cimentación/obra gris, " +
      "levantar paredes, instalaciones, y avanza hacia los acabados. Incluye todas las etapas que falten.",
    MEDIAS:
      "La obra está EN PROCESO (hay cosas hechas y cosas pendientes). Propón una mezcla razonable de " +
      "tareas intermedias y de acabado; evita tareas de cimentación si ya no aplican.",
    AVANZADA:
      "La obra está PRÓXIMA A FINALIZAR (falta poco). Sugiere SOLO tareas de cierre y acabados: " +
      "repello/resane de paredes, pintura, instalación de puertas, cocina y closets, enchapes, " +
      "instalación de baños/grifería, detalles y aseo final. NO sugieras levantar paredes, estructura " +
      "ni obra gris (eso ya está hecho).",
  };
  const etapa = args.puntoPartida && ETAPA[args.puntoPartida] ? `\n${ETAPA[args.puntoPartida]}\n` : "";

  const system =
    "Eres un maestro de obra colombiano con 20 años de experiencia en remodelaciones y construcción. " +
    "Conoces las tareas reales y su orden de ejecución para cada espacio o elemento de una obra. " +
    "Hablas claro: explicas las tareas en palabras que cualquier persona entiende, sin tecnicismos. " +
    "Respondes siempre en español neutro, formal pero sencillo, y SOLO en JSON válido.";

  const user =
    `Obra: ${obra} de un ${prop}${ciudad}.${etapa}\n` +
    `Para CADA espacio/elemento de la lista, indica ÚNICAMENTE las tareas que realmente apliquen a ese ` +
    `espacio Y a la etapa de la obra, en orden lógico, con los días hábiles que suele tomar cada una ` +
    `(entero >=1). NO incluyas tareas que no correspondan al espacio (en "pisos" no pongas tareas de pared; ` +
    `en "techo" pon cielo raso/pintura de techo, no piso). Entre 3 y 8 tareas por espacio.\n\n` +
    `MUY IMPORTANTE — usa nombres ENTENDIBLES para alguien sin conocimientos técnicos (formal pero llano). ` +
    `Evita tecnicismos. Ejemplos: di "levantar paredes (ladrillo o bloque)" en vez de "mampostería"; ` +
    `"repello/revoque de paredes" en vez de "pañete"; "instalar baldosa o cerámica" en vez de "enchape"; ` +
    `"alisar y emparejar paredes" en vez de "estuco"; "puntos de luz y tomas" en vez de "salidas eléctricas". ` +
    `Que cualquiera entienda qué se va a hacer.\n\n` +
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

// ── Estimación de presupuesto con IA (anclada en la base semilla) ───────────

export interface TareaPrecioInput {
  i: number;
  espacio: string;
  tarea: string;
  dias: number;
  metraje?: number;
}

export type PreciosResult =
  | { ok: true; data: Record<number, number> }
  | { ok: false; motivo: "sin_key" | "error" };

/** Resumen compacto de la base semilla para anclar a la IA (evita alucinar). */
function anclasPrecios(): string {
  return PRECIOS_SEMILLA.map((p) => {
    const mat = p.incluyeMaterial === "no" ? " (solo mano de obra)" : p.incluyeMaterial === "si" ? " (a todo costo)" : "";
    return `- ${p.label}: ~$${p.medianoCOP.toLocaleString("es-CO")} por ${p.unidad}${mat}`;
  }).join("\n");
}

/**
 * Estima el COSTO TOTAL realista (mano de obra + materiales típicos) en COP de
 * cada tarea, ANCLADO en los precios de referencia de Colombia (base semilla).
 * Correlación por índice. La base semilla evita que la IA alucine cifras; para
 * tareas fuera de la lista usa su conocimiento del mercado colombiano.
 */
export async function estimarPreciosIA(args: {
  tareas: TareaPrecioInput[];
  tipoObra: string;
  tipoPropiedad: string;
  ciudad?: string | null;
}): Promise<PreciosResult> {
  if (!process.env.DEEPSEEK_API_KEY) return { ok: false, motivo: "sin_key" };
  const tareas = args.tareas.slice(0, 200);
  if (tareas.length === 0) return { ok: false, motivo: "error" };

  const obra = LABEL_OBRA[args.tipoObra] || "obra de construcción";
  const prop = LABEL_PROP[args.tipoPropiedad] || "propiedad";
  const ciudad = args.ciudad ? ` en ${args.ciudad}, Colombia` : " en Colombia";

  const lista = tareas.map((t) => ({
    i: t.i,
    espacio: t.espacio,
    tarea: t.tarea,
    dias: t.dias,
    ...(t.metraje && t.metraje > 0 ? { m2: Math.round(t.metraje) } : {}),
  }));

  const system =
    "Eres un maestro de obra colombiano experto en presupuestos de remodelación y construcción. " +
    "Estimas el COSTO TOTAL realista en pesos colombianos (COP), incluyendo mano de obra Y materiales típicos. " +
    "Te anclas en precios de referencia reales y respondes SOLO en JSON válido.";

  const user =
    `Obra: ${obra} de un ${prop}${ciudad}.\n` +
    `Estima el COSTO TOTAL en COP de CADA tarea (mano de obra + materiales típicos instalados). ` +
    `Considera el espacio y su área (m2) si se indica; si no hay área, asume un tamaño típico para ese espacio. ` +
    `Sé realista con el mercado colombiano actual (p. ej. unos muebles de cocina o un clóset cuestan millones, no cientos de miles).\n\n` +
    `Precios de referencia REALES de Colombia (úsalos como ancla; la mayoría son solo mano de obra, súmale materiales cuando aplique):\n` +
    `${anclasPrecios()}\n\n` +
    `Tareas: ${JSON.stringify(lista)}\n\n` +
    `Responde SOLO con JSON, usando el MISMO índice "i": {"precios":[{"i":0,"precio":<entero COP, costo total de la tarea>}]}`;

  const parsed = await chatJSON<{ precios?: { i?: number; precio?: unknown }[] }>({
    system,
    user,
    maxTokens: 2500,
  });
  if (!parsed?.precios || !Array.isArray(parsed.precios)) return { ok: false, motivo: "error" };

  const data: Record<number, number> = {};
  for (const item of parsed.precios) {
    const i = Number(item?.i);
    const precio = Math.round(Number(item?.precio));
    if (Number.isInteger(i) && Number.isFinite(precio) && precio >= 0) {
      data[i] = Math.min(precio, INT_CAP);
    }
  }
  return Object.keys(data).length ? { ok: true, data } : { ok: false, motivo: "error" };
}
