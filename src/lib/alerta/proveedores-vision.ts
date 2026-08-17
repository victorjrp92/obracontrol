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
  armar(args: {
    key: string;
    systemPrompt: string;
    maxTokens: number;
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

const OBSERVACION_TOOL = {
  name: "reportar_observacion",
  description:
    "Reporta la observación estructurada de la grieta a partir de las dos fotos, sin diagnóstico ni consejo.",
  input_schema: {
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
    // `escala` va ANTES de `ancho_mm` a propósito: obliga al modelo a escribir
    // el razonamiento de escala antes de emitir el número. El campo NO viaja al
    // motor de reglas — `normalizarObservacion` lo ignora, como cualquier clave
    // desconocida.
    required: ["elemento", "patron", "escala", "ancho_mm", "banderas", "confianza", "calidad_foto", "nota_visual"],
  },
};

const anthropic = (modelo: string): ProveedorVision => ({
  nombre: "anthropic",
  variableKey: "ANTHROPIC_API_KEY",
  modelo,
  armar({ key, systemPrompt, maxTokens, cerca, lejos, textoCerca, textoLejos }) {
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

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Esquema en el dialecto de Gemini (subconjunto de OpenAPI 3.0), NO JSON Schema:
 *
 *   - `type: ["number","null"]` no existe → se expresa con `nullable: true`.
 *   - El orden de `properties` NO se respeta al generar; hay que declararlo
 *     aparte en `propertyOrdering`. Esto importa de verdad aquí: todo el truco
 *     de precisión del ancho depende de que el modelo escriba `escala` ANTES
 *     que `ancho_mm`. Sin propertyOrdering, Gemini puede emitir el número
 *     primero y el razonamiento después — o sea, inventar el número y luego
 *     justificarlo, que es exactamente lo que el prompt intenta evitar.
 */
const ESQUEMA_GEMINI = {
  type: "object",
  properties: {
    elemento: {
      type: "string",
      enum: ELEMENTOS,
      description: "Tipo de elemento estructural que se ve en la Foto 2 (elemento completo).",
    },
    patron: { type: "string", enum: PATRONES, description: "Patrón geométrico de la grieta." },
    escala: { type: "string", description: DESC_ESCALA },
    ancho_mm: { type: "number", nullable: true, description: DESC_ANCHO },
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
      propertyOrdering: [
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
      propertyOrdering: ["elemento", "patron", "ancho"],
    },
    calidad_foto: { type: "string", enum: CALIDADES },
    nota_visual: { type: "string", description: DESC_NOTA },
  },
  required: ["elemento", "patron", "escala", "ancho_mm", "banderas", "confianza", "calidad_foto", "nota_visual"],
  propertyOrdering: [
    "elemento",
    "patron",
    "escala", // ← antes de ancho_mm, a propósito
    "ancho_mm",
    "banderas",
    "confianza",
    "calidad_foto",
    "nota_visual",
  ],
};

const gemini = (modelo: string): ProveedorVision => ({
  nombre: "gemini",
  variableKey: "GEMINI_API_KEY",
  modelo,
  armar({ key, systemPrompt, maxTokens, cerca, lejos, textoCerca, textoLejos }) {
    return {
      // La clave va en cabecera y NO como `?key=` en la URL: una URL con
      // secreto termina en logs de proxy, en trazas de error y en el
      // historial de cualquier herramienta que toque la petición.
      url: `${GEMINI_BASE}/${encodeURIComponent(modelo)}:generateContent`,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      cuerpo: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: textoCerca },
              { inlineData: { mimeType: cerca.mediaType, data: cerca.base64 } },
              { text: textoLejos },
              { inlineData: { mimeType: lejos.mediaType, data: lejos.base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          responseSchema: ESQUEMA_GEMINI,
        },
      }),
    };
  },
  extraer(data) {
    const d = data as Record<string, unknown> | null;
    const candidatos = Array.isArray(d?.candidates) ? (d.candidates as unknown[]) : [];
    const primero = candidatos[0] as Record<string, unknown> | undefined;
    const contenido = primero?.content as Record<string, unknown> | undefined;
    const partes = Array.isArray(contenido?.parts) ? (contenido.parts as unknown[]) : [];
    // Con responseMimeType JSON la respuesta llega como texto en la primera
    // parte; si el modelo se corta por maxOutputTokens el JSON queda truncado
    // y el parse falla — se trata como fallo y cae a modo manual, que es lo
    // correcto: media observación es peor que ninguna.
    const texto = partes
      .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>).text : null))
      .find((t): t is string => typeof t === "string" && t.trim().length > 0);
    if (!texto) return null;
    try {
      return JSON.parse(texto);
    } catch {
      return null;
    }
  },
});

// ═══════════════════════════════════════════════════════════════════════════

/** Modelo por defecto de cada proveedor, sobreescribible con ALERTA_VISION_MODEL. */
const MODELO_POR_DEFECTO: Record<string, string> = {
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash",
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
