/**
 * Adaptadores de proveedor de visión para Seiricon Alerta (SOLO servidor).
 *
 * POR QUÉ EXISTE ESTA CAPA
 * El prompt, el esquema, la sanitización (`normalizarObservacion`,
 * `sanitizarNotaVisual`) y la política de reintento son lo caro y lo que está
 * calibrado: eso NO se duplica por proveedor. Lo único que cambia entre uno y
 * otro es la forma del sobre — a qué URL se manda, con qué cabecera, cómo se
 * empaquetan las dos fotos y de qué rincón de la respuesta se saca el JSON.
 * Eso es lo que abstrae este archivo, y nada más.
 *
 * CAMBIAR DE PROVEEDOR es poner `ALERTA_VISION_PROVEEDOR` en Vercel. Volver
 * atrás es lo mismo. Ningún despliegue de código, ningún archivo tocado.
 *
 * ⚠️ AL CAMBIAR DE PROVEEDOR HAY QUE ACTUALIZAR `/privacidad`: la sección 0.2
 * nombra al proveedor y su país, porque las fotos son datos personales y la
 * Ley 1581 exige decir a dónde viajan. Si el texto dice Anthropic y el tráfico
 * va a Google, la política miente.
 */

/** Un intento ya empaquetado, listo para `fetch`. */
export interface PeticionVision {
  url: string;
  headers: Record<string, string>;
  cuerpo: string;
}

export interface FotoVision {
  mediaType: string;
  base64: string;
}

export interface ProveedorVision {
  /** Nombre para diagnóstico. NUNCA se escribe en logs junto al cuerpo. */
  nombre: string;
  /** Variable de entorno de la que sale la clave. */
  variableKey: string;
  /** Modelo efectivo (ya resuelto contra ALERTA_VISION_MODEL). */
  modelo: string;
  /**
   * Tope de tokens de salida. NO es el mismo para todos y no es un detalle:
   * los modelos que razonan antes de responder gastan de este mismo
   * presupuesto, así que un tope pensado para un modelo directo deja al que
   * razona sin sitio para el JSON. Medido, no estimado — ver cada adaptador.
   */
  maxTokens: number;
  armar(args: {
    key: string;
    systemPrompt: string;
    cerca: FotoVision;
    lejos: FotoVision;
    textoCerca: string;
    textoLejos: string;
  }): PeticionVision;
  /**
   * Saca el objeto estructurado de la respuesta cruda. Devuelve null si la
   * respuesta no trae lo esperado — el caller lo trata como fallo y cae a
   * modo manual, igual que cualquier otro error.
   */
  extraer(data: unknown): unknown | null;
}

/** Enum compartido: la fuente de verdad de los valores válidos es tipos.ts. */
const ELEMENTOS = [
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
const PATRONES = [
  "diagonal",
  "diagonal_x",
  "vertical",
  "horizontal",
  "escalonada",
  "craquelado",
  "esquina_vano",
  "junta_entre_elementos",
];
const CALIDADES = ["ok", "oscura", "movida", "muy_lejos", "sin_referencia_escala"];

const DESC_ESCALA =
  "Razonamiento de escala ANTES de estimar el ancho: dónde ves la moneda de $500 (diámetro 23,7 mm) y cuántas veces cabe el ancho de la grieta en su diámetro. Si no la distingues con claridad o está en otro plano, escríbelo aquí y reporta calidad_foto = 'sin_referencia_escala'. Máximo ~200 caracteres.";
const DESC_ANCHO =
  "Ancho estimado de la grieta en milímetros, derivado del razonamiento del campo 'escala'. null si no se puede estimar.";
const DESC_NOTA =
  "Una frase corta y neutral de lo que se ve. Sin juicios de seguridad ni consejos. Máximo ~140 caracteres.";

// ═══════════════════════════════════════════════════════════════════════════
// Anthropic — Claude Haiku 4.5
// ═══════════════════════════════════════════════════════════════════════════

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/**
 * Esquema de la observación. JSON Schema estándar, compartido por los dos
 * proveedores: Anthropic lo consume como `input_schema` de un tool y Gemini
 * como `response_format[].schema`. Un solo sitio que tocar cuando cambie el
 * contrato — dos copias divergiendo es cómo un proveedor empieza a devolver
 * campos que el otro no.
 */
const ESQUEMA_OBSERVACION = {
  type: "object",
  properties: {
    elemento: {
      type: "string",
      enum: ELEMENTOS,
      description: "Tipo de elemento estructural que se ve en la Foto 2 (elemento completo).",
    },
    patron: { type: "string", enum: PATRONES, description: "Patrón geométrico de la grieta." },
    escala: { type: "string", description: DESC_ESCALA },
    ancho_mm: { type: ["number", "null"], description: DESC_ANCHO },
    banderas: {
      type: "object",
      properties: {
        acero_expuesto: { type: "boolean" },
        concreto_triturado: { type: "boolean" },
        desplazamiento_caras: {
          type: "boolean",
          description: "Un lado de la grieta quedó más alto/adelante que el otro.",
        },
        elemento_inclinado: { type: "boolean" },
        separacion_muro_estructura: { type: "boolean" },
      },
      required: [
        "acero_expuesto",
        "concreto_triturado",
        "desplazamiento_caras",
        "elemento_inclinado",
        "separacion_muro_estructura",
      ],
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
    calidad_foto: { type: "string", enum: CALIDADES },
    nota_visual: { type: "string", description: DESC_NOTA },
  },
  // `escala` va ANTES de `ancho_mm` en `properties` y en `required` a propósito:
  // el modelo tiende a emitir los campos en ese orden, así que el razonamiento
  // de escala sale antes que el número. El refuerzo de verdad está en el prompt
  // (pasos 2 y 3), que lo pide explícitamente — el esquema solo acompaña.
  // El campo NO viaja al motor de reglas: `normalizarObservacion` lo ignora,
  // como cualquier clave desconocida.
  required: ["elemento", "patron", "escala", "ancho_mm", "banderas", "confianza", "calidad_foto", "nota_visual"],
};

const OBSERVACION_TOOL = {
  name: "reportar_observacion",
  description:
    "Reporta la observación estructurada de la grieta a partir de las dos fotos, sin diagnóstico ni consejo.",
  input_schema: ESQUEMA_OBSERVACION,
};

const anthropic = (modelo: string): ProveedorVision => ({
  nombre: "anthropic",
  variableKey: "ANTHROPIC_API_KEY",
  modelo,
  // Responde directo, sin paso de razonamiento: el JSON de la observación ronda
  // los 250 tokens y 700 va sobrado.
  maxTokens: 700,
  armar({ key, systemPrompt, cerca, lejos, textoCerca, textoLejos }) {
    const maxTokens = 700;
    return {
      url: ANTHROPIC_URL,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      cuerpo: JSON.stringify({
        model: modelo,
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        tools: [OBSERVACION_TOOL],
        tool_choice: { type: "tool", name: OBSERVACION_TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: textoCerca },
              { type: "image", source: { type: "base64", media_type: cerca.mediaType, data: cerca.base64 } },
              { type: "text", text: textoLejos },
              { type: "image", source: { type: "base64", media_type: lejos.mediaType, data: lejos.base64 } },
            ],
          },
        ],
      }),
    };
  },
  extraer(data) {
    const d = data as Record<string, unknown> | null;
    const content: unknown[] = Array.isArray(d?.content) ? (d.content as unknown[]) : [];
    const toolUse = content.find(
      (b): b is { type: "tool_use"; input: unknown } =>
        !!b && typeof b === "object" && (b as Record<string, unknown>).type === "tool_use"
    );
    return toolUse ? toolUse.input : null;
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Google — Gemini Flash
// ═══════════════════════════════════════════════════════════════════════════

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
/** Revisión del contrato de la API. Fijarla evita que un cambio de esquema del
 *  lado de Google rompa el parseo sin que toquemos nada. */
const GEMINI_REVISION = "2026-05-20";

const gemini = (modelo: string): ProveedorVision => ({
  nombre: "gemini",
  variableKey: "GEMINI_API_KEY",
  modelo,
  // Gemini 3.x emite un paso `thought` ANTES de la respuesta, y ese
  // razonamiento gasta de este mismo presupuesto. Medido contra el esquema
  // real: con 700 el JSON sale cortado a 173 caracteres y `JSON.parse` falla;
  // con 2000 sale completo. 2500 deja margen para fotos que den más que pensar.
  maxTokens: 2500,
  armar({ key, systemPrompt, cerca, lejos, textoCerca, textoLejos }) {
    const maxTokens = 2500;
    return {
      // Interactions API. La antigua `:generateContent` con
      // `generationConfig.responseSchema` quedó atrás: Google puso el 8 de
      // junio de 2026 como fecha límite de migración, así que escribir contra
      // ella hoy es escribir contra una puerta cerrada — y el fallo sería
      // silencioso, porque un 4xx no se reintenta y todo el mundo caería a
      // modo manual sin que nada avise.
      url: GEMINI_URL,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        // Fija el contrato: sin esto la API puede servir otra revisión del
        // esquema y romper el parseo sin que cambiemos una línea.
        "Api-Revision": GEMINI_REVISION,
      },
      cuerpo: JSON.stringify({
        model: modelo,
        system_instruction: systemPrompt,
        input: [
          { type: "text", text: textoCerca },
          { type: "image", mime_type: cerca.mediaType, data: cerca.base64 },
          { type: "text", text: textoLejos },
          { type: "image", mime_type: lejos.mediaType, data: lejos.base64 },
        ],
        generation_config: { temperature: 0, max_output_tokens: maxTokens },
        // `response_format` es un ARRAY, no un objeto.
        response_format: [
          { type: "text", mime_type: "application/json", schema: ESQUEMA_OBSERVACION },
        ],
        // Que Google no conserve la interacción. Son fotos del interior de la
        // casa de alguien y /privacidad promete que no se almacenan: la
        // promesa tiene que viajar en la petición, no solo en el texto legal.
        store: false,
      }),
    };
  },
  extraer(data) {
    const d = data as Record<string, unknown> | null;
    const steps = Array.isArray(d?.steps) ? (d.steps as unknown[]) : [];
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const s = step as Record<string, unknown>;
      if (s.type !== "model_output") continue;
      const contenido = Array.isArray(s.content) ? (s.content as unknown[]) : [];
      for (const bloque of contenido) {
        if (!bloque || typeof bloque !== "object") continue;
        const b = bloque as Record<string, unknown>;
        if (b.type !== "text" || typeof b.text !== "string" || !b.text.trim()) continue;
        try {
          return JSON.parse(b.text);
        } catch {
          // JSON truncado (tope de tokens) o texto libre: se trata como fallo
          // y cae a modo manual. Media observación es peor que ninguna.
          return null;
        }
      }
    }
    return null;
  },
});

// ═══════════════════════════════════════════════════════════════════════════

/** Modelo por defecto de cada proveedor, sobreescribible con ALERTA_VISION_MODEL. */
const MODELO_POR_DEFECTO: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  // gemini-2.5-flash está marcado para retiro el 16 de octubre de 2026: no
  // sirve como cimiento. 3.7 Flash es el vigente (13 de agosto de 2026).
  // Si el volumen aprieta, la palanca barata es gemini-3.1-flash-lite —
  // pero es el modelo más débil justo en lo que aquí importa, medir un ancho
  // en milímetros, así que esa palanca se jala con calibración, no a ciegas.
  gemini: "gemini-3.7-flash",
};

/**
 * Proveedor activo según `ALERTA_VISION_PROVEEDOR`.
 *
 * Por defecto **anthropic**: es el que está calibrado contra el arnés, así que
 * usar Gemini tiene que ser una decisión explícita y visible en el panel de
 * Vercel — y volver atrás, una sola variable.
 */
export function proveedorActivo(): ProveedorVision {
  const nombre = (process.env.ALERTA_VISION_PROVEEDOR ?? "anthropic").trim().toLowerCase();
  const modelo = process.env.ALERTA_VISION_MODEL || MODELO_POR_DEFECTO[nombre] || MODELO_POR_DEFECTO.anthropic;
  return nombre === "gemini" ? gemini(modelo) : anthropic(modelo);
}
